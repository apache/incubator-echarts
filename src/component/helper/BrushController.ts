/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/


import {curry, each, map, bind, merge, clone, defaults, assert} from 'zrender/src/core/util';
import Eventful from 'zrender/src/core/Eventful';
import * as graphic from '../../util/graphic';
import * as interactionMutex from './interactionMutex';
import DataDiffer from '../../data/DataDiffer';
import { Dictionary } from '../../util/types';
import { ZRenderType } from 'zrender/src/zrender';
import { ElementEvent } from 'zrender/src/Element';
import * as matrix from 'zrender/src/core/matrix';
import Displayable from 'zrender/src/graphic/Displayable';
import { PathStyleProps } from 'zrender/src/graphic/Path';


/**
 * BrushController not only used in "brush component",
 * but also used in "tooltip DataZoom", and other possible
 * futher brush behavior related scenarios.
 * So `BrushController` should not depends on "brush component model".
 */


export type BrushType = 'polygon' | 'rect' | 'lineX' | 'lineY';
/**
 * Only for drawing (after enabledBrush).
 * 'line', 'rect', 'polygon' or false
 * If passing false/null/undefined, disable brush.
 * If passing 'auto', determined by panel.defaultBrushType
 */
export type BrushTypeUncertain = BrushType | false | 'auto';

export type BrushMode = 'single' | 'multiple';
// MinMax: Range of linear brush.
// MinMax[]: Range of multi-dimension like rect/polygon, which is a MinMax
//     list for each dimension of the coord sys. For example:
//     cartesian: [[xMin, xMax], [yMin, yMax]]
//     geo: [[lngMin, lngMin], [latMin, latMax]]
export type BrushDimensionMinMax = number[];
export type BrushAreaRange = BrushDimensionMinMax | BrushDimensionMinMax[];

export interface BrushCoverConfig {
    // Mandatory. determine how to convert to/from coord('rect' or 'polygon' or 'lineX/Y')
    brushType: BrushType;
    // Can be specified by user to map covers in `updateCovers`
    // in `dispatchAction({type: 'brush', areas: [{id: ...}, ...]})`
    id?: string;
    // Range in global coordinate (pixel).
    range?: BrushAreaRange;
    // When create a new area by `updateCovers`, panelId should be specified.
    // If not null/undefined, means global panel.
    // Also see `BrushAreaParam['panelId']`.
    panelId?: string;

    brushMode?: BrushMode;
    // `brushStyle`, `transformable` is not mandatory, use DEFAULT_BRUSH_OPT by default.
    brushStyle?: Pick<PathStyleProps, BrushStyleKey>;
    transformable?: boolean;
    removeOnClick?: boolean;
    z?: number;

    // Cursor style when mouse is outside the brush
    outOfBrushCursor?: string;
    // Cursor style when mouse is inside the brush
    inBrushCursor?: string;
}

/**
 * `BrushAreaCreatorOption` input to brushModel via `setBrushOption`,
 * merge and convert to `BrushCoverCreatorConfig`.
 */
export interface BrushCoverCreatorConfig extends Pick<
    BrushCoverConfig,
    'brushMode' | 'transformable' | 'removeOnClick' | 'brushStyle' | 'z' | 'outOfBrushCursor' | 'inBrushCursor'
> {
    brushType: BrushTypeUncertain;
}

type BrushStyleKey =
    'fill'
    | 'stroke'
    | 'lineWidth'
    | 'opacity'
    | 'shadowBlur'
    | 'shadowOffsetX'
    | 'shadowOffsetY'
    | 'shadowColor';


const BRUSH_PANEL_GLOBAL = true as const;

export interface BrushPanelConfig {
    // mandatory.
    panelId: string;
    // mandatory.
    clipPath(localPoints: number[][], transform: matrix.MatrixArray): number[][];
    // mandatory.
    isTargetByCursor(e: ElementEvent, localCursorPoint: number[], transform: matrix.MatrixArray): boolean;
    // optional, only used when brushType is 'auto'.
    defaultBrushType?: BrushType;
    // optional.
    getLinearBrushOtherExtent?(xyIndex: number): number[];
}
// `true` represents global panel;
type BrushPanelConfigOrGlobal = BrushPanelConfig | typeof BRUSH_PANEL_GLOBAL;


interface BrushCover extends graphic.Group {
    __brushOption: BrushCoverConfig;
}

type Point = number[];

const mathMin = Math.min;
const mathMax = Math.max;
const mathPow = Math.pow;

const COVER_Z = 10000;
const UNSELECT_THRESHOLD = 6;
const MIN_RESIZE_LINE_WIDTH = 6;
const MUTEX_RESOURCE_KEY = 'globalPan';

type DirectionName = 'w' | 'e' | 'n' | 's';
type DirectionNameSequence = DirectionName[];

const DIRECTION_MAP = {
    w: [0, 0],
    e: [0, 1],
    n: [1, 0],
    s: [1, 1]
} as const;
const CURSOR_MAP = {
    w: 'ew',
    e: 'ew',
    n: 'ns',
    s: 'ns',
    ne: 'nesw',
    sw: 'nesw',
    nw: 'nwse',
    se: 'nwse'
} as const;
const DEFAULT_BRUSH_OPT = {
    outOfBrushCursor: 'crosshair',
    inBrushCursor: 'move',
    brushStyle: {
        lineWidth: 2,
        stroke: 'rgba(210,219,238,0.3)',
        fill: '#D2DBEE'
    },
    transformable: true,
    brushMode: 'single',
    removeOnClick: false
};

let baseUID = 0;

export interface BrushControllerEvents {
    brush: {
        areas: {
            brushType: BrushType;
            panelId: string;
            range: BrushAreaRange;
        }[];
        isEnd: boolean;
        removeOnClick: boolean;
    }
}

/**
 * params:
 *     areas: Array.<Array>, coord relates to container group,
 *                             If no container specified, to global.
 *     opt {
 *         isEnd: boolean,
 *         removeOnClick: boolean
 *     }
 */
class BrushController extends Eventful<BrushControllerEvents> {

    readonly group: graphic.Group;

    /**
     * @internal
     */
    _zr: ZRenderType;

    /**
     * @internal
     */
    _brushType: BrushTypeUncertain;

    /**
     * @internal
     * Only for drawing (after enabledBrush).
     */
    _brushOption: BrushCoverCreatorConfig;

    /**
     * @internal
     * Key: panelId
     */
    _panels: Dictionary<BrushPanelConfig>;

    /**
     * @internal
     */
    _track: number[][] = [];

    /**
     * @internal
     */
    _dragging: boolean;

    /**
     * @internal
     */
    _covers: BrushCover[] = [];

    /**
     * @internal
     */
    _creatingCover: BrushCover;

    /**
     * @internal
     */
    _creatingPanel: BrushPanelConfigOrGlobal;

    private _enableGlobalPan: boolean;

    private _mounted: boolean;

    /**
     * @internal
     */
    _transform: matrix.MatrixArray;

    private _uid: string;

    private _handlers: {
        [eventName: string]: (this: BrushController, e: ElementEvent) => void
    } = {};


    constructor(zr: ZRenderType) {
        super();

        if (__DEV__) {
            assert(zr);
        }

        this._zr = zr;

        this.group = new graphic.Group();

        this._uid = 'brushController_' + baseUID++;

        each(pointerHandlers, function (this: BrushController, handler, eventName) {
            this._handlers[eventName] = bind(handler, this);
        }, this);
    }

    /**
     * If set to `false`, select disabled.
     */
    enableBrush(brushOption: Partial<BrushCoverCreatorConfig> | false): BrushController {
        if (__DEV__) {
            assert(this._mounted);
        }

        this._brushType && this._doDisableBrush();
        (brushOption as Partial<BrushCoverCreatorConfig>).brushType && this._doEnableBrush(
            brushOption as Partial<BrushCoverCreatorConfig>
        );

        return this;
    }

    private _doEnableBrush(brushOption: Partial<BrushCoverCreatorConfig>): void {
        const zr = this._zr;

        // Consider roam, which takes globalPan too.
        if (!this._enableGlobalPan) {
            interactionMutex.take(zr, MUTEX_RESOURCE_KEY, this._uid);
        }

        each(this._handlers, function (handler, eventName) {
            zr.on(eventName, handler);
        });

        this._brushType = brushOption.brushType;
        this._brushOption = merge(
            clone(DEFAULT_BRUSH_OPT), brushOption, true
        ) as BrushCoverCreatorConfig;
    }

    private _doDisableBrush(): void {
        const zr = this._zr;

        interactionMutex.release(zr, MUTEX_RESOURCE_KEY, this._uid);

        each(this._handlers, function (handler, eventName) {
            zr.off(eventName, handler);
        });

        this._brushType = this._brushOption = null;
    }

    /**
     * @param panelOpts If not pass, it is global brush.
     */
    setPanels(panelOpts?: BrushPanelConfig[]): BrushController {
        if (panelOpts && panelOpts.length) {
            const panels = this._panels = {} as Dictionary<BrushPanelConfig>;
            each(panelOpts, function (panelOpts) {
                panels[panelOpts.panelId] = clone(panelOpts);
            });
        }
        else {
            this._panels = null;
        }
        return this;
    }

    mount(opt?: {
        enableGlobalPan?: boolean;
        x?: number;
        y?: number;
        rotation?: number;
        scaleX?: number;
        scaleY?: number
    }): BrushController {
        opt = opt || {};

        if (__DEV__) {
            this._mounted = true; // should be at first.
        }

        this._enableGlobalPan = opt.enableGlobalPan;

        const thisGroup = this.group;
        this._zr.add(thisGroup);

        thisGroup.attr({
            x: opt.x || 0,
            y: opt.y || 0,
            rotation: opt.rotation || 0,
            scaleX: opt.scaleX || 1,
            scaleY: opt.scaleY || 1
        });
        this._transform = thisGroup.getLocalTransform();

        return this;
    }

    // eachCover(cb, context): void {
    //     each(this._covers, cb, context);
    // }

    /**
     * Update covers.
     * @param coverConfigList
     *        If coverConfigList is null/undefined, all covers removed.
     */
    updateCovers(coverConfigList: BrushCoverConfig[]) {
        if (__DEV__) {
            assert(this._mounted);
        }

        coverConfigList = map(coverConfigList, function (coverConfig) {
            return merge(clone(DEFAULT_BRUSH_OPT), coverConfig, true);
        }) as BrushCoverConfig[];

        const tmpIdPrefix = '\0-brush-index-';
        const oldCovers = this._covers;
        const newCovers = this._covers = [] as BrushCover[];
        const controller = this;
        const creatingCover = this._creatingCover;

        (new DataDiffer(oldCovers, coverConfigList, oldGetKey, getKey))
            .add(addOrUpdate)
            .update(addOrUpdate)
            .remove(remove)
            .execute();

        return this;

        function getKey(brushOption: BrushCoverConfig, index: number): string {
            return (brushOption.id != null ? brushOption.id : tmpIdPrefix + index)
                + '-' + brushOption.brushType;
        }

        function oldGetKey(cover: BrushCover, index: number): string {
            return getKey(cover.__brushOption, index);
        }

        function addOrUpdate(newIndex: number, oldIndex?: number): void {
            const newBrushInternal = coverConfigList[newIndex];
            // Consider setOption in event listener of brushSelect,
            // where updating cover when creating should be forbiden.
            if (oldIndex != null && oldCovers[oldIndex] === creatingCover) {
                newCovers[newIndex] = oldCovers[oldIndex];
            }
            else {
                const cover = newCovers[newIndex] = oldIndex != null
                    ? (
                        oldCovers[oldIndex].__brushOption = newBrushInternal,
                        oldCovers[oldIndex]
                    )
                    : endCreating(controller, createCover(controller, newBrushInternal));
                updateCoverAfterCreation(controller, cover);
            }
        }

        function remove(oldIndex: number) {
            if (oldCovers[oldIndex] !== creatingCover) {
                controller.group.remove(oldCovers[oldIndex]);
            }
        }
    }

    unmount() {
        if (__DEV__) {
            if (!this._mounted) {
                return;
            }
        }

        this.enableBrush(false);

        // container may 'removeAll' outside.
        clearCovers(this);
        this._zr.remove(this.group);

        if (__DEV__) {
            this._mounted = false; // should be at last.
        }

        return this;
    }

    dispose() {
        this.unmount();
        this.off();
    }
}


function createCover(controller: BrushController, brushOption: BrushCoverConfig): BrushCover {
    const cover = coverRenderers[brushOption.brushType].createCover(controller, brushOption);
    cover.__brushOption = brushOption;
    updateZ(cover, brushOption);
    controller.group.add(cover);
    return cover;
}

function endCreating(controller: BrushController, creatingCover: BrushCover): BrushCover {
    const coverRenderer = getCoverRenderer(creatingCover);
    if (coverRenderer.endCreating) {
        coverRenderer.endCreating(controller, creatingCover);
        updateZ(creatingCover, creatingCover.__brushOption);
    }
    return creatingCover;
}

function updateCoverShape(controller: BrushController, cover: BrushCover): void {
    const brushOption = cover.__brushOption;
    getCoverRenderer(cover).updateCoverShape(
        controller, cover, brushOption.range, brushOption
    );
}

function updateZ(cover: BrushCover, brushOption: BrushCoverConfig): void {
    let z = brushOption.z;
    z == null && (z = COVER_Z);
    cover.traverse(function (el: Displayable) {
        el.z = z;
        el.z2 = z; // Consider in given container.
    });
}

function updateCoverAfterCreation(controller: BrushController, cover: BrushCover): void {
    getCoverRenderer(cover).updateCommon(controller, cover);
    updateCoverShape(controller, cover);
}

function getCoverRenderer(cover: BrushCover): CoverRenderer {
    return coverRenderers[cover.__brushOption.brushType];
}

// return target panel or `true` (means global panel)
function getPanelByPoint(
    controller: BrushController,
    e: ElementEvent,
    localCursorPoint: Point
): BrushPanelConfigOrGlobal {
    const panels = controller._panels;
    if (!panels) {
        return BRUSH_PANEL_GLOBAL; // Global panel
    }
    let panel;
    const transform = controller._transform;
    each(panels, function (pn) {
        pn.isTargetByCursor(e, localCursorPoint, transform) && (panel = pn);
    });
    return panel;
}

// Return a panel or true
function getPanelByCover(controller: BrushController, cover: BrushCover): BrushPanelConfigOrGlobal {
    const panels = controller._panels;
    if (!panels) {
        return BRUSH_PANEL_GLOBAL; // Global panel
    }
    const panelId = cover.__brushOption.panelId;
    // User may give cover without coord sys info,
    // which is then treated as global panel.
    return panelId != null ? panels[panelId] : BRUSH_PANEL_GLOBAL;
}

function clearCovers(controller: BrushController): boolean {
    const covers = controller._covers;
    const originalLength = covers.length;
    each(covers, function (cover) {
        controller.group.remove(cover);
    }, controller);
    covers.length = 0;

    return !!originalLength;
}

function trigger(
    controller: BrushController,
    opt: {isEnd?: boolean, removeOnClick?: boolean}
): void {
    const areas = map(controller._covers, function (cover) {
        const brushOption = cover.__brushOption;
        const range = clone(brushOption.range);
        return {
            brushType: brushOption.brushType,
            panelId: brushOption.panelId,
            range: range
        };
    });

    controller.trigger('brush', {
        areas: areas,
        isEnd: !!opt.isEnd,
        removeOnClick: !!opt.removeOnClick
    });
}

function shouldShowCover(controller: BrushController): boolean {
    const track = controller._track;

    if (!track.length) {
        return false;
    }

    const p2 = track[track.length - 1];
    const p1 = track[0];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist = mathPow(dx * dx + dy * dy, 0.5);

    return dist > UNSELECT_THRESHOLD;
}

function getTrackEnds(track: Point[]): Point[] {
    let tail = track.length - 1;
    tail < 0 && (tail = 0);
    return [track[0], track[tail]];
}

interface RectRangeConverter {
    toRectRange: (range: BrushAreaRange) => BrushDimensionMinMax[];
    fromRectRange: (areaRange: BrushDimensionMinMax[]) => BrushAreaRange;
};
function createBaseRectCover(
    rectRangeConverter: RectRangeConverter,
    controller: BrushController,
    brushOption: BrushCoverConfig,
    edgeNameSequences: DirectionNameSequence[]
): BrushCover {
    const cover = new graphic.Group() as BrushCover;

    cover.add(new graphic.Rect({
        name: 'main',
        style: makeStyle(brushOption),
        silent: true,
        draggable: true,
        cursor: brushOption.inBrushCursor,
        drift: curry(driftRect, rectRangeConverter, controller, cover, ['n', 's', 'w', 'e']),
        ondragend: curry(trigger, controller, {isEnd: true})
    }));

    each(
        edgeNameSequences,
        function (nameSequence) {
            cover.add(new graphic.Rect({
                name: nameSequence.join(''),
                style: {opacity: 0},
                draggable: true,
                silent: true,
                invisible: true,
                drift: curry(driftRect, rectRangeConverter, controller, cover, nameSequence),
                ondragend: curry(trigger, controller, {isEnd: true})
            }));
        }
    );

    return cover;
}

function updateBaseRect(
    controller: BrushController,
    cover: BrushCover,
    localRange: BrushDimensionMinMax[],
    brushOption: BrushCoverConfig
): void {
    const lineWidth = brushOption.brushStyle.lineWidth || 0;
    const handleSize = mathMax(lineWidth, MIN_RESIZE_LINE_WIDTH);
    const x = localRange[0][0];
    const y = localRange[1][0];
    const xa = x - lineWidth / 2;
    const ya = y - lineWidth / 2;
    const x2 = localRange[0][1];
    const y2 = localRange[1][1];
    const x2a = x2 - handleSize + lineWidth / 2;
    const y2a = y2 - handleSize + lineWidth / 2;
    const width = x2 - x;
    const height = y2 - y;
    const widtha = width + lineWidth;
    const heighta = height + lineWidth;

    updateRectShape(controller, cover, 'main', x, y, width, height);

    if (brushOption.transformable) {
        updateRectShape(controller, cover, 'w', xa, ya, handleSize, heighta);
        updateRectShape(controller, cover, 'e', x2a, ya, handleSize, heighta);
        updateRectShape(controller, cover, 'n', xa, ya, widtha, handleSize);
        updateRectShape(controller, cover, 's', xa, y2a, widtha, handleSize);

        updateRectShape(controller, cover, 'nw', xa, ya, handleSize, handleSize);
        updateRectShape(controller, cover, 'ne', x2a, ya, handleSize, handleSize);
        updateRectShape(controller, cover, 'sw', xa, y2a, handleSize, handleSize);
        updateRectShape(controller, cover, 'se', x2a, y2a, handleSize, handleSize);
    }
}

function updateCommon(controller: BrushController, cover: BrushCover): void {
    const brushOption = cover.__brushOption;
    const transformable = brushOption.transformable;

    const mainEl = cover.childAt(0) as Displayable;
    mainEl.useStyle(makeStyle(brushOption));
    mainEl.attr({
        silent: !transformable,
        cursor: transformable ? cover.__brushOption.inBrushCursor : 'default'
    });

    each(
        [['w'], ['e'], ['n'], ['s'], ['s', 'e'], ['s', 'w'], ['n', 'e'], ['n', 'w']],
        function (nameSequence: DirectionNameSequence) {
            const el = cover.childOfName(nameSequence.join('')) as Displayable;
            const globalDir = nameSequence.length === 1
                ? getGlobalDirection1(controller, nameSequence[0])
                : getGlobalDirection2(controller, nameSequence);

            el && el.attr({
                silent: !transformable,
                invisible: !transformable,
                cursor: transformable ? CURSOR_MAP[globalDir] + '-resize' : null
            });
        }
    );
}

function updateRectShape(
    controller: BrushController,
    cover: BrushCover,
    name: string,
    x: number, y: number, w: number, h: number
): void {
    const el = cover.childOfName(name) as graphic.Rect;
    el && el.setShape(pointsToRect(
        clipByPanel(controller, cover, [[x, y], [x + w, y + h]])
    ));
}

function makeStyle(brushOption: BrushCoverConfig) {
    return defaults({strokeNoScale: true}, brushOption.brushStyle);
}

function formatRectRange(x: number, y: number, x2: number, y2: number): BrushDimensionMinMax[] {
    const min = [mathMin(x, x2), mathMin(y, y2)];
    const max = [mathMax(x, x2), mathMax(y, y2)];

    return [
        [min[0], max[0]], // x range
        [min[1], max[1]] // y range
    ];
}

function getTransform(controller: BrushController): matrix.MatrixArray {
    return graphic.getTransform(controller.group);
}

function getGlobalDirection1(
    controller: BrushController, localDirName: DirectionName
): keyof typeof CURSOR_MAP {
    const map = {w: 'left', e: 'right', n: 'top', s: 'bottom'} as const;
    const inverseMap = {left: 'w', right: 'e', top: 'n', bottom: 's'} as const;
    const dir = graphic.transformDirection(
        map[localDirName], getTransform(controller)
    );
    return inverseMap[dir];
}
function getGlobalDirection2(
    controller: BrushController, localDirNameSeq: DirectionNameSequence
): keyof typeof CURSOR_MAP {
    const globalDir = [
        getGlobalDirection1(controller, localDirNameSeq[0]),
        getGlobalDirection1(controller, localDirNameSeq[1])
    ];
    (globalDir[0] === 'e' || globalDir[0] === 'w') && globalDir.reverse();
    return globalDir.join('') as keyof typeof CURSOR_MAP;
}

function driftRect(
    rectRangeConverter: RectRangeConverter,
    controller: BrushController,
    cover: BrushCover,
    dirNameSequence: DirectionNameSequence,
    dx: number,
    dy: number
): void {
    const brushOption = cover.__brushOption;
    const rectRange = rectRangeConverter.toRectRange(brushOption.range);
    const localDelta = toLocalDelta(controller, dx, dy);

    each(dirNameSequence, function (dirName) {
        const ind = DIRECTION_MAP[dirName];
        rectRange[ind[0]][ind[1]] += localDelta[ind[0]];
    });

    brushOption.range = rectRangeConverter.fromRectRange(formatRectRange(
        rectRange[0][0], rectRange[1][0], rectRange[0][1], rectRange[1][1]
    ));

    updateCoverAfterCreation(controller, cover);
    trigger(controller, {isEnd: false});
}

function driftPolygon(
    controller: BrushController,
    cover: BrushCover,
    dx: number,
    dy: number
): void {
    const range = cover.__brushOption.range as BrushDimensionMinMax[];
    const localDelta = toLocalDelta(controller, dx, dy);

    each(range, function (point) {
        point[0] += localDelta[0];
        point[1] += localDelta[1];
    });

    updateCoverAfterCreation(controller, cover);
    trigger(controller, {isEnd: false});
}

function toLocalDelta(
    controller: BrushController, dx: number, dy: number
): BrushDimensionMinMax {
    const thisGroup = controller.group;
    const localD = thisGroup.transformCoordToLocal(dx, dy);
    const localZero = thisGroup.transformCoordToLocal(0, 0);

    return [localD[0] - localZero[0], localD[1] - localZero[1]];
}

function clipByPanel(controller: BrushController, cover: BrushCover, data: Point[]): Point[] {
    const panel = getPanelByCover(controller, cover);

    return (panel && panel !== BRUSH_PANEL_GLOBAL)
        ? panel.clipPath(data, controller._transform)
        : clone(data);
}

function pointsToRect(points: Point[]): graphic.Rect['shape'] {
    const xmin = mathMin(points[0][0], points[1][0]);
    const ymin = mathMin(points[0][1], points[1][1]);
    const xmax = mathMax(points[0][0], points[1][0]);
    const ymax = mathMax(points[0][1], points[1][1]);

    return {
        x: xmin,
        y: ymin,
        width: xmax - xmin,
        height: ymax - ymin
    };
}

function resetCursor(
    controller: BrushController, e: ElementEvent, localCursorPoint: Point
): void {
    if (
        // Check active
        !controller._brushType
        // resetCursor should be always called when mouse is in zr area,
        // but not called when mouse is out of zr area to avoid bad influence
        // if `mousemove`, `mouseup` are triggered from `document` event.
        || isOutsideZrArea(controller, e.offsetX, e.offsetY)
    ) {
        return;
    }

    const zr = controller._zr;
    const covers = controller._covers;
    const currPanel = getPanelByPoint(controller, e, localCursorPoint);

    // Check whether in covers.
    if (!controller._dragging) {
        for (let i = 0; i < covers.length; i++) {
            const brushOption = covers[i].__brushOption;
            if (currPanel
                && (currPanel === BRUSH_PANEL_GLOBAL || brushOption.panelId === currPanel.panelId)
                && coverRenderers[brushOption.brushType].contain(
                    covers[i], localCursorPoint[0], localCursorPoint[1]
                )
            ) {
                // Use cursor style set on cover.
                return;
            }
        }
    }

    currPanel && zr.setCursorStyle(controller._brushOption.outOfBrushCursor);
}

function preventDefault(e: ElementEvent): void {
    const rawE = e.event;
    rawE.preventDefault && rawE.preventDefault();
}

function mainShapeContain(cover: BrushCover, x: number, y: number): boolean {
    return (cover.childOfName('main') as Displayable).contain(x, y);
}

function updateCoverByMouse(
    controller: BrushController,
    e: ElementEvent,
    localCursorPoint: Point,
    isEnd: boolean
): {
    isEnd: boolean,
    removeOnClick?: boolean
} {
    let creatingCover = controller._creatingCover;
    const panel = controller._creatingPanel;
    const thisBrushOption = controller._brushOption;
    let eventParams;

    controller._track.push(localCursorPoint.slice());

    if (shouldShowCover(controller) || creatingCover) {

        if (panel && !creatingCover) {
            thisBrushOption.brushMode === 'single' && clearCovers(controller);
            const brushOption = clone(thisBrushOption) as BrushCoverConfig;
            brushOption.brushType = determineBrushType(brushOption.brushType, panel as BrushPanelConfig);
            brushOption.panelId = panel === BRUSH_PANEL_GLOBAL ? null : panel.panelId;
            creatingCover = controller._creatingCover = createCover(controller, brushOption);
            controller._covers.push(creatingCover);
        }

        if (creatingCover) {
            const coverRenderer = coverRenderers[
                determineBrushType(controller._brushType, panel as BrushPanelConfig)
            ];
            const coverBrushOption = creatingCover.__brushOption;

            coverBrushOption.range = coverRenderer.getCreatingRange(
                clipByPanel(controller, creatingCover, controller._track)
            );

            if (isEnd) {
                endCreating(controller, creatingCover);
                coverRenderer.updateCommon(controller, creatingCover);
            }

            updateCoverShape(controller, creatingCover);

            eventParams = {isEnd: isEnd};
        }
    }
    else if (
        isEnd
        && thisBrushOption.brushMode === 'single'
        && thisBrushOption.removeOnClick
    ) {
        // Help user to remove covers easily, only by a tiny drag, in 'single' mode.
        // But a single click do not clear covers, because user may have casual
        // clicks (for example, click on other component and do not expect covers
        // disappear).
        // Only some cover removed, trigger action, but not every click trigger action.
        if (getPanelByPoint(controller, e, localCursorPoint) && clearCovers(controller)) {
            eventParams = {isEnd: isEnd, removeOnClick: true};
        }
    }

    return eventParams;
}

function determineBrushType(brushType: BrushTypeUncertain, panel: BrushPanelConfig): BrushType {
    if (brushType === 'auto') {
        if (__DEV__) {
            assert(
                panel && panel.defaultBrushType,
                'MUST have defaultBrushType when brushType is "atuo"'
            );
        }
        return panel.defaultBrushType;
    }
    return brushType as BrushType;
}

const pointerHandlers: Dictionary<(this: BrushController, e: ElementEvent) => void> = {

    mousedown: function (e) {
        if (this._dragging) {
            // In case some browser do not support globalOut,
            // and release mouse out side the browser.
            handleDragEnd(this, e);
        }
        else if (!e.target || !e.target.draggable) {

            preventDefault(e);

            const localCursorPoint = this.group.transformCoordToLocal(e.offsetX, e.offsetY);

            this._creatingCover = null;
            const panel = this._creatingPanel = getPanelByPoint(this, e, localCursorPoint);

            if (panel) {
                this._dragging = true;
                this._track = [localCursorPoint.slice()];
            }
        }
    },

    mousemove: function (e) {
        const x = e.offsetX;
        const y = e.offsetY;

        const localCursorPoint = this.group.transformCoordToLocal(x, y);

        resetCursor(this, e, localCursorPoint);

        if (this._dragging) {
            preventDefault(e);
            const eventParams = updateCoverByMouse(this, e, localCursorPoint, false);
            eventParams && trigger(this, eventParams);
        }
    },

    mouseup: function (e) {
        handleDragEnd(this, e);
    }
};


function handleDragEnd(controller: BrushController, e: ElementEvent) {
    if (controller._dragging) {
        preventDefault(e);

        const x = e.offsetX;
        const y = e.offsetY;

        const localCursorPoint = controller.group.transformCoordToLocal(x, y);
        const eventParams = updateCoverByMouse(controller, e, localCursorPoint, true);

        controller._dragging = false;
        controller._track = [];
        controller._creatingCover = null;

        // trigger event shoule be at final, after procedure will be nested.
        eventParams && trigger(controller, eventParams);
    }
}

function isOutsideZrArea(controller: BrushController, x: number, y: number): boolean {
    const zr = controller._zr;
    return x < 0 || x > zr.getWidth() || y < 0 || y > zr.getHeight();
}


interface CoverRenderer {
    createCover(controller: BrushController, brushOption: BrushCoverConfig): BrushCover;
    getCreatingRange(localTrack: Point[]): BrushAreaRange;
    updateCoverShape(
        controller: BrushController, cover: BrushCover, localRange: BrushAreaRange, brushOption: BrushCoverConfig
    ): void;
    updateCommon(controller: BrushController, cover: BrushCover): void;
    contain(cover: BrushCover, x: number, y: number): boolean;
    endCreating?(controller: BrushController, creatingCover: BrushCover): void;
}

/**
 * key: brushType
 */
const coverRenderers: Record<BrushType, CoverRenderer> = {

    lineX: getLineRenderer(0),

    lineY: getLineRenderer(1),

    rect: {
        createCover: function (controller, brushOption) {
            function returnInput(range: BrushDimensionMinMax[]): BrushDimensionMinMax[] {
                return range;
            }
            return createBaseRectCover(
                {
                    toRectRange: returnInput,
                    fromRectRange: returnInput
                },
                controller,
                brushOption,
                [['w'], ['e'], ['n'], ['s'], ['s', 'e'], ['s', 'w'], ['n', 'e'], ['n', 'w']]
            );
        },
        getCreatingRange: function (localTrack) {
            const ends = getTrackEnds(localTrack);
            return formatRectRange(ends[1][0], ends[1][1], ends[0][0], ends[0][1]);
        },
        updateCoverShape: function (controller, cover, localRange: BrushDimensionMinMax[], brushOption) {
            updateBaseRect(controller, cover, localRange, brushOption);
        },
        updateCommon: updateCommon,
        contain: mainShapeContain
    },

    polygon: {
        createCover: function (controller, brushOption) {
            const cover = new graphic.Group();

            // Do not use graphic.Polygon because graphic.Polyline do not close the
            // border of the shape when drawing, which is a better experience for user.
            cover.add(new graphic.Polyline({
                name: 'main',
                style: makeStyle(brushOption),
                silent: true
            }));

            return cover as BrushCover;
        },
        getCreatingRange: function (localTrack) {
            return localTrack;
        },
        endCreating: function (controller, cover) {
            cover.remove(cover.childAt(0));
            // Use graphic.Polygon close the shape.
            cover.add(new graphic.Polygon({
                name: 'main',
                draggable: true,
                drift: curry(driftPolygon, controller, cover),
                ondragend: curry(trigger, controller, {isEnd: true})
            }));
        },
        updateCoverShape: function (controller, cover, localRange: BrushDimensionMinMax[], brushOption) {
            (cover.childAt(0) as graphic.Polygon).setShape({
                points: clipByPanel(controller, cover, localRange)
            });
        },
        updateCommon: updateCommon,
        contain: mainShapeContain
    }
};

function getLineRenderer(xyIndex: 0 | 1) {
    return {
        createCover: function (controller: BrushController, brushOption: BrushCoverConfig): BrushCover {
            return createBaseRectCover(
                {
                    toRectRange: function (range: BrushDimensionMinMax): BrushDimensionMinMax[] {
                        const rectRange = [range, [0, 100]];
                        xyIndex && rectRange.reverse();
                        return rectRange;
                    },
                    fromRectRange: function (rectRange: BrushDimensionMinMax[]): BrushDimensionMinMax {
                        return rectRange[xyIndex];
                    }
                },
                controller,
                brushOption,
                ([[['w'], ['e']], [['n'], ['s']]] as DirectionNameSequence[][])[xyIndex]
            );
        },
        getCreatingRange: function (localTrack: Point[]): BrushDimensionMinMax {
            const ends = getTrackEnds(localTrack);
            const min = mathMin(ends[0][xyIndex], ends[1][xyIndex]);
            const max = mathMax(ends[0][xyIndex], ends[1][xyIndex]);

            return [min, max];
        },
        updateCoverShape: function (
            controller: BrushController,
            cover: BrushCover,
            localRange: BrushDimensionMinMax,
            brushOption: BrushCoverConfig
        ): void {
            let otherExtent;
            // If brushWidth not specified, fit the panel.
            const panel = getPanelByCover(controller, cover);
            if (panel !== BRUSH_PANEL_GLOBAL && panel.getLinearBrushOtherExtent) {
                otherExtent = panel.getLinearBrushOtherExtent(xyIndex);
            }
            else {
                const zr = controller._zr;
                otherExtent = [0, [zr.getWidth(), zr.getHeight()][1 - xyIndex]];
            }
            const rectRange = [localRange, otherExtent];
            xyIndex && rectRange.reverse();

            updateBaseRect(controller, cover, rectRange, brushOption);
        },
        updateCommon: updateCommon,
        contain: mainShapeContain
    };
}

export default BrushController;
