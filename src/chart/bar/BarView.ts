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

import Path, {PathProps} from 'zrender/src/graphic/Path';
import Group from 'zrender/src/graphic/Group';
import {extend, defaults, each, map} from 'zrender/src/core/util';
import {BuiltinTextPosition} from 'zrender/src/core/types';
import {
    Rect,
    Sector,
    updateProps,
    initProps,
    removeElementWithFadeOut
} from '../../util/graphic';
import { getECData } from '../../util/innerStore';
import { enableHoverEmphasis, setStatesStylesFromModel } from '../../util/states';
import { setLabelStyle, getLabelStatesModels, setLabelValueAnimation } from '../../label/labelStyle';
import {throttle} from '../../util/throttle';
import {createClipPath} from '../helper/createClipPathFromCoordSys';
import Sausage from '../../util/shape/sausage';
import ChartView from '../../view/Chart';
import List, {DefaultDataVisual} from '../../data/List';
import GlobalModel from '../../model/Global';
import ExtensionAPI from '../../core/ExtensionAPI';
import {
    StageHandlerProgressParams,
    ZRElementEvent,
    ColorString,
    OrdinalSortInfo,
    Payload,
    OrdinalNumber,
    ParsedValue
} from '../../util/types';
import BarSeriesModel, {BarSeriesOption, BarDataItemOption, PolarBarLabelPosition} from './BarSeries';
import type Axis2D from '../../coord/cartesian/Axis2D';
import type Cartesian2D from '../../coord/cartesian/Cartesian2D';
import type Polar from '../../coord/polar/Polar';
import type Model from '../../model/Model';
import { isCoordinateSystemType } from '../../coord/CoordinateSystem';
import { getDefaultLabel, getDefaultInterpolatedLabel } from '../helper/labelHelper';
import OrdinalScale from '../../scale/Ordinal';
import SeriesModel from '../../model/Series';
import {AngleAxisModel, RadiusAxisModel} from '../../coord/polar/AxisModel';
import CartesianAxisModel from '../../coord/cartesian/AxisModel';
import {LayoutRect} from '../../util/layout';
import {EventCallback} from 'zrender/src/core/Eventful';
import { warn } from '../../util/log';
import {createSectorCalculateTextPosition, SectorTextPosition, setSectorTextRotation} from '../../label/sectorLabel';
import { saveOldStyle } from '../../animation/basicTrasition';

const _eventPos = [0, 0];

const mathMax = Math.max;
const mathMin = Math.min;

type CoordSysOfBar = BarSeriesModel['coordinateSystem'];
type RectShape = Rect['shape'];
type SectorShape = Sector['shape'];

type SectorLayout = SectorShape;
type RectLayout = RectShape;

type BarPossiblePath = Sector | Rect | Sausage;

type CartesianCoordArea = ReturnType<Cartesian2D['getArea']>;
type PolarCoordArea = ReturnType<Polar['getArea']>;

type RealtimeSortConfig = {
    baseAxis: Axis2D;
    otherAxis: Axis2D;
};
// Return a number, based on which the ordinal sorted.
type OrderMapping = (dataIndex: number) => number;

function getClipArea(coord: CoordSysOfBar, data: List) {
    const coordSysClipArea = coord.getArea && coord.getArea();
    if (isCoordinateSystemType<Cartesian2D>(coord, 'cartesian2d')) {
        const baseAxis = coord.getBaseAxis();
        // When boundaryGap is false or using time axis. bar may exceed the grid.
        // We should not clip this part.
        // See test/bar2.html
        if (baseAxis.type !== 'category' || !baseAxis.onBand) {
            const expandWidth = data.getLayout('bandWidth');
            if (baseAxis.isHorizontal()) {
                (coordSysClipArea as CartesianCoordArea).x -= expandWidth;
                (coordSysClipArea as CartesianCoordArea).width += expandWidth * 2;
            }
            else {
                (coordSysClipArea as CartesianCoordArea).y -= expandWidth;
                (coordSysClipArea as CartesianCoordArea).height += expandWidth * 2;
            }
        }
    }

    return coordSysClipArea as PolarCoordArea | CartesianCoordArea;
}

class BarView extends ChartView {
    static type = 'bar' as const;
    type = BarView.type;

    private _data: List;

    private _isLargeDraw: boolean;

    private _isFirstFrame: boolean; // First frame after series added
    private _onRendered: EventCallback;

    private _backgroundGroup: Group;

    private _backgroundEls: (Rect | Sector)[];

    private _model: BarSeriesModel;

    constructor() {
        super();
        this._isFirstFrame = true;
    }

    render(seriesModel: BarSeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload) {
        this._model = seriesModel;

        this._removeOnRenderedListener(api);

        this._updateDrawMode(seriesModel);

        const coordinateSystemType = seriesModel.get('coordinateSystem');

        if (coordinateSystemType === 'cartesian2d'
            || coordinateSystemType === 'polar'
        ) {
            this._isLargeDraw
                ? this._renderLarge(seriesModel, ecModel, api)
                : this._renderNormal(seriesModel, ecModel, api, payload);
        }
        else if (__DEV__) {
            warn('Only cartesian2d and polar supported for bar.');
        }
    }

    incrementalPrepareRender(seriesModel: BarSeriesModel): void {
        this._clear();
        this._updateDrawMode(seriesModel);
        // incremental also need to clip, otherwise might be overlow.
        // But must not set clip in each frame, otherwise all of the children will be marked redraw.
        this._updateLargeClip(seriesModel);
    }

    incrementalRender(params: StageHandlerProgressParams, seriesModel: BarSeriesModel): void {
        // Do not support progressive in normal mode.
        this._incrementalRenderLarge(params, seriesModel);
    }

    private _updateDrawMode(seriesModel: BarSeriesModel): void {
        const isLargeDraw = seriesModel.pipelineContext.large;
        if (this._isLargeDraw == null || isLargeDraw !== this._isLargeDraw) {
            this._isLargeDraw = isLargeDraw;
            this._clear();
        }
    }

    private _renderNormal(
        seriesModel: BarSeriesModel,
        ecModel: GlobalModel,
        api: ExtensionAPI,
        payload: Payload
    ): void {
        const group = this.group;
        const data = seriesModel.getData();
        const oldData = this._data;

        const coord = seriesModel.coordinateSystem;
        const baseAxis = coord.getBaseAxis();
        let isHorizontalOrRadial: boolean;

        if (coord.type === 'cartesian2d') {
            isHorizontalOrRadial = (baseAxis as Axis2D).isHorizontal();
        }
        else if (coord.type === 'polar') {
            isHorizontalOrRadial = baseAxis.dim === 'angle';
        }

        const animationModel = seriesModel.isAnimationEnabled() ? seriesModel : null;

        const realtimeSortCfg = shouldRealtimeSort(seriesModel, coord);

        if (realtimeSortCfg) {
            this._enableRealtimeSort(realtimeSortCfg, data, api);
        }

        const needsClip = seriesModel.get('clip', true) || realtimeSortCfg;
        const coordSysClipArea = getClipArea(coord, data);
        // If there is clipPath created in large mode. Remove it.
        group.removeClipPath();
        // We don't use clipPath in normal mode because we needs a perfect animation
        // And don't want the label are clipped.

        const roundCap = seriesModel.get('roundCap', true);

        const drawBackground = seriesModel.get('showBackground', true);
        const backgroundModel = seriesModel.getModel('backgroundStyle');
        const barBorderRadius = backgroundModel.get('borderRadius') || 0;

        const bgEls: BarView['_backgroundEls'] = [];
        const oldBgEls = this._backgroundEls;

        const isInitSort = payload && payload.isInitSort;
        const isChangeOrder = payload && payload.type === 'changeAxisOrder';

        function createBackground(dataIndex: number) {
            const bgLayout = getLayout[coord.type](data, dataIndex);
            const bgEl = createBackgroundEl(coord, isHorizontalOrRadial, bgLayout);
            bgEl.useStyle(backgroundModel.getItemStyle());
            // Only cartesian2d support borderRadius.
            if (coord.type === 'cartesian2d') {
                (bgEl as Rect).setShape('r', barBorderRadius);
            }
            bgEls[dataIndex] = bgEl;
            return bgEl;
        };
        data.diff(oldData)
            .add(function (dataIndex) {
                const itemModel = data.getItemModel<BarDataItemOption>(dataIndex);
                const layout = getLayout[coord.type](data, dataIndex, itemModel);

                if (drawBackground) {
                    createBackground(dataIndex);
                }

                // If dataZoom in filteMode: 'empty', the baseValue can be set as NaN in "axisProxy".
                if (!data.hasValue(dataIndex) || !isValidLayout[coord.type](layout)) {
                    return;
                }

                let isClipped = false;
                if (needsClip) {
                    // Clip will modify the layout params.
                    // And return a boolean to determine if the shape are fully clipped.
                    isClipped = clip[coord.type](coordSysClipArea, layout);
                }

                const el = elementCreator[coord.type](
                    seriesModel,
                    data,
                    dataIndex,
                    layout,
                    isHorizontalOrRadial,
                    animationModel,
                    baseAxis.model,
                    false,
                    roundCap
                );

                updateStyle(
                    el, data, dataIndex, itemModel, layout,
                    seriesModel, isHorizontalOrRadial, coord.type === 'polar'
                );
                if (isInitSort) {
                    (el as Rect).attr({ shape: layout });
                }
                else if (realtimeSortCfg) {
                    updateRealtimeAnimation(
                        realtimeSortCfg,
                        animationModel,
                        el as Rect,
                        layout as LayoutRect,
                        dataIndex,
                        isHorizontalOrRadial,
                        false,
                        false
                    );
                }
                else {
                    initProps(el, {shape: layout} as any, seriesModel, dataIndex);
                }

                data.setItemGraphicEl(dataIndex, el);

                group.add(el);
                el.ignore = isClipped;
            })
            .update(function (newIndex, oldIndex) {
                const itemModel = data.getItemModel<BarDataItemOption>(newIndex);
                const layout = getLayout[coord.type](data, newIndex, itemModel);

                if (drawBackground) {
                    let bgEl: Rect | Sector;
                    if (oldBgEls.length === 0) {
                        bgEl = createBackground(oldIndex);
                    }
                    else {
                        bgEl = oldBgEls[oldIndex];
                        bgEl.useStyle(backgroundModel.getItemStyle());
                        // Only cartesian2d support borderRadius.
                        if (coord.type === 'cartesian2d') {
                            (bgEl as Rect).setShape('r', barBorderRadius);
                        }
                        bgEls[newIndex] = bgEl;
                    }
                    const bgLayout = getLayout[coord.type](data, newIndex);
                    const shape = createBackgroundShape(isHorizontalOrRadial, bgLayout, coord);
                    updateProps(bgEl, { shape }, animationModel, newIndex);
                }

                let el = oldData.getItemGraphicEl(oldIndex) as BarPossiblePath;
                if (!data.hasValue(newIndex) || !isValidLayout[coord.type](layout)) {
                    group.remove(el);
                    return;
                }

                let isClipped = false;
                if (needsClip) {
                    isClipped = clip[coord.type](coordSysClipArea, layout);
                    if (isClipped) {
                        group.remove(el);
                    }
                }

                if (!el) {
                    el = elementCreator[coord.type](
                        seriesModel,
                        data,
                        newIndex,
                        layout,
                        isHorizontalOrRadial,
                        animationModel,
                        baseAxis.model,
                        !!el,
                        roundCap
                    );
                }
                else {
                    saveOldStyle(el);
                }

                // Not change anything if only order changed.
                // Especially not change label.
                if (!isChangeOrder) {
                    updateStyle(
                        el, data, newIndex, itemModel, layout,
                        seriesModel, isHorizontalOrRadial, coord.type === 'polar'
                    );
                }

                if (isInitSort) {
                    (el as Rect).attr({ shape: layout });
                }
                else if (realtimeSortCfg) {
                    updateRealtimeAnimation(
                        realtimeSortCfg,
                        animationModel,
                        el as Rect,
                        layout as LayoutRect,
                        newIndex,
                        isHorizontalOrRadial,
                        true,
                        isChangeOrder
                    );
                }
                else {
                    updateProps(el, {
                        shape: layout
                    } as any, seriesModel, newIndex, null);
                }

                data.setItemGraphicEl(newIndex, el);
                el.ignore = isClipped;
                group.add(el);
            })
            .remove(function (dataIndex) {
                const el = oldData.getItemGraphicEl(dataIndex) as Path;
                el && removeElementWithFadeOut(el, seriesModel, dataIndex);
            })
            .execute();

        const bgGroup = this._backgroundGroup || (this._backgroundGroup = new Group());
        bgGroup.removeAll();

        for (let i = 0; i < bgEls.length; ++i) {
            bgGroup.add(bgEls[i]);
        }
        group.add(bgGroup);
        this._backgroundEls = bgEls;

        this._data = data;
    }

    private _renderLarge(seriesModel: BarSeriesModel, ecModel: GlobalModel, api: ExtensionAPI): void {
        this._clear();
        createLarge(seriesModel, this.group);
        this._updateLargeClip(seriesModel);
    }

    private _incrementalRenderLarge(params: StageHandlerProgressParams, seriesModel: BarSeriesModel): void {
        this._removeBackground();
        createLarge(seriesModel, this.group, true);
    }

    private _updateLargeClip(seriesModel: BarSeriesModel): void {
        // Use clipPath in large mode.
        const clipPath = seriesModel.get('clip', true)
            ? createClipPath(seriesModel.coordinateSystem, false, seriesModel)
            : null;
        if (clipPath) {
            this.group.setClipPath(clipPath);
        }
        else {
            this.group.removeClipPath();
        }
    }

    private _enableRealtimeSort(
        realtimeSortCfg: RealtimeSortConfig,
        data: ReturnType<BarSeriesModel['getData']>,
        api: ExtensionAPI
    ): void {
        // If no data in the first frame, wait for data to initSort
        if (!data.count()) {
            return;
        }

        const baseAxis = realtimeSortCfg.baseAxis;

        if (this._isFirstFrame) {
            this._dispatchInitSort(data, realtimeSortCfg, api);
            this._isFirstFrame = false;
        }
        else {
            const orderMapping = (idx: number) => {
                const el = (data.getItemGraphicEl(idx) as Rect);
                if (el) {
                    const shape = el.shape;
                    // If data is NaN, shape.xxx may be NaN, so use || 0 here in case
                    return (
                        baseAxis.isHorizontal()
                            // The result should be consistent with the initial sort by data value.
                            // Do not support the case that both positive and negative exist.
                            ? Math.abs(shape.height)
                            : Math.abs(shape.width)
                    ) || 0;
                }
                else {
                    return 0;
                }
            };
            this._onRendered = () => {
                this._updateSortWithinSameData(data, orderMapping, baseAxis, api);
            };
            api.getZr().on('rendered', this._onRendered);
        }
    }

    private _dataSort(
        data: List<BarSeriesModel, DefaultDataVisual>,
        baseAxis: Axis2D,
        orderMapping: OrderMapping
    ): OrdinalSortInfo {
        type SortValueInfo = {
            dataIndex: number,
            mappedValue: number,
            ordinalNumber: OrdinalNumber
        };
        const info: SortValueInfo[] = [];
        data.each(data.mapDimension(baseAxis.dim), (ordinalNumber: OrdinalNumber, dataIdx: number) => {
            let mappedValue = orderMapping(dataIdx);
            mappedValue = mappedValue == null ? NaN : mappedValue;
            info.push({
                dataIndex: dataIdx,
                mappedValue: mappedValue,
                ordinalNumber: ordinalNumber
            });
        });

        info.sort((a, b) => {
            // If NaN, it will be treated as min val.
            return b.mappedValue - a.mappedValue;
        });

        return {
            ordinalNumbers: map(info, item => item.ordinalNumber)
        };
    }

    private _isOrderChangedWithinSameData(
        data: List<BarSeriesModel, DefaultDataVisual>,
        orderMapping: OrderMapping,
        baseAxis: Axis2D
    ): boolean {
        const scale = baseAxis.scale as OrdinalScale;
        const ordinalDataDim = data.mapDimension(baseAxis.dim);

        let lastValue = Number.MAX_VALUE;
        for (let tickNum = 0, len = scale.getOrdinalMeta().categories.length; tickNum < len; ++tickNum) {
            const rawIdx = data.rawIndexOf(ordinalDataDim, scale.getRawOrdinalNumber(tickNum));
            const value = rawIdx < 0
                // If some tick have no bar, the tick will be treated as min.
                ? Number.MIN_VALUE
                // PENDING: if dataZoom on baseAxis exits, is it a performance issue?
                : orderMapping(data.indexOfRawIndex(rawIdx));
            if (value > lastValue) {
                return true;
            }
            lastValue = value;
        }
        return false;
    }

    /*
     * Consider the case when A and B changed order, whose representing
     * bars are both out of sight, we don't wish to trigger reorder action
     * as long as the order in the view doesn't change.
     */
    private _isOrderDifferentInView(
        orderInfo: OrdinalSortInfo,
        baseAxis: Axis2D
    ): boolean {
        const scale = baseAxis.scale as OrdinalScale;
        const extent = scale.getExtent();

        let tickNum = Math.max(0, extent[0]);
        const tickMax = Math.min(extent[1], scale.getOrdinalMeta().categories.length - 1);
        for (;tickNum <= tickMax; ++tickNum) {
            if (orderInfo.ordinalNumbers[tickNum] !== scale.getRawOrdinalNumber(tickNum)) {
                return true;
            }
        }
    }

    private _updateSortWithinSameData(
        data: List<BarSeriesModel, DefaultDataVisual>,
        orderMapping: OrderMapping,
        baseAxis: Axis2D,
        api: ExtensionAPI
    ) {
        if (!this._isOrderChangedWithinSameData(data, orderMapping, baseAxis)) {
            return;
        }

        const sortInfo = this._dataSort(data, baseAxis, orderMapping);

        if (this._isOrderDifferentInView(sortInfo, baseAxis)) {
            this._removeOnRenderedListener(api);
            api.dispatchAction({
                type: 'changeAxisOrder',
                componentType: baseAxis.dim + 'Axis',
                axisId: baseAxis.index,
                sortInfo: sortInfo
            });
        }
    }

    private _dispatchInitSort(
        data: List<BarSeriesModel, DefaultDataVisual>,
        realtimeSortCfg: RealtimeSortConfig,
        api: ExtensionAPI
    ) {
        const baseAxis = realtimeSortCfg.baseAxis;
        const sortResult = this._dataSort(
            data,
            baseAxis,
            dataIdx => data.get(
                data.mapDimension(realtimeSortCfg.otherAxis.dim),
                dataIdx
            ) as number
        );
        api.dispatchAction({
            type: 'changeAxisOrder',
            componentType: baseAxis.dim + 'Axis',
            isInitSort: true,
            axisId: baseAxis.index,
            sortInfo: sortResult
        });
    }

    remove(ecModel: GlobalModel, api: ExtensionAPI) {
        this._clear(this._model);
        this._removeOnRenderedListener(api);
    }

    dispose(ecModel: GlobalModel, api: ExtensionAPI) {
        this._removeOnRenderedListener(api);
    }

    private _removeOnRenderedListener(api: ExtensionAPI) {
        if (this._onRendered) {
            api.getZr().off('rendered', this._onRendered);
            this._onRendered = null;
        }
    }

    private _clear(model?: SeriesModel): void {
        const group = this.group;
        const data = this._data;
        if (model && model.isAnimationEnabled() && data && !this._isLargeDraw) {
            this._removeBackground();
            this._backgroundEls = [];

            data.eachItemGraphicEl(function (el: Path) {
                removeElementWithFadeOut(el, model, getECData(el).dataIndex);
            });
        }
        else {
            group.removeAll();
        }
        this._data = null;
        this._isFirstFrame = true;
    }

    private _removeBackground(): void {
        this.group.remove(this._backgroundGroup);
        this._backgroundGroup = null;
    }
}

interface Clipper {
    (coordSysBoundingRect: PolarCoordArea | CartesianCoordArea, layout: RectLayout | SectorLayout): boolean
}
const clip: {
    [key in 'cartesian2d' | 'polar']: Clipper
} = {
    cartesian2d(coordSysBoundingRect: CartesianCoordArea, layout: Rect['shape']) {
        const signWidth = layout.width < 0 ? -1 : 1;
        const signHeight = layout.height < 0 ? -1 : 1;
        // Needs positive width and height
        if (signWidth < 0) {
            layout.x += layout.width;
            layout.width = -layout.width;
        }
        if (signHeight < 0) {
            layout.y += layout.height;
            layout.height = -layout.height;
        }

        const coordSysX2 = coordSysBoundingRect.x + coordSysBoundingRect.width;
        const coordSysY2 = coordSysBoundingRect.y + coordSysBoundingRect.height;
        const x = mathMax(layout.x, coordSysBoundingRect.x);
        const x2 = mathMin(layout.x + layout.width, coordSysX2);
        const y = mathMax(layout.y, coordSysBoundingRect.y);
        const y2 = mathMin(layout.y + layout.height, coordSysY2);

        const xClipped = x2 < x;
        const yClipped = y2 < y;

        // When xClipped or yClipped, the element will be marked as `ignore`.
        // But we should also place the element at the edge of the coord sys bounding rect.
        // Beause if data changed and the bar show again, its transition animaiton
        // will begin at this place.
        layout.x = (xClipped && x > coordSysX2) ? x2 : x;
        layout.y = (yClipped && y > coordSysY2) ? y2 : y;
        layout.width = xClipped ? 0 : x2 - x;
        layout.height = yClipped ? 0 : y2 - y;

        // Reverse back
        if (signWidth < 0) {
            layout.x += layout.width;
            layout.width = -layout.width;
        }
        if (signHeight < 0) {
            layout.y += layout.height;
            layout.height = -layout.height;
        }

        return xClipped || yClipped;
    },

    polar(coordSysClipArea: PolarCoordArea, layout: Sector['shape']) {
        const signR = layout.r0 <= layout.r ? 1 : -1;
        // Make sure r is larger than r0
        if (signR < 0) {
            const tmp = layout.r;
            layout.r = layout.r0;
            layout.r0 = tmp;
        }

        const r = mathMin(layout.r, coordSysClipArea.r);
        const r0 = mathMax(layout.r0, coordSysClipArea.r0);

        layout.r = r;
        layout.r0 = r0;

        const clipped = r - r0 < 0;

        // Reverse back
        if (signR < 0) {
            const tmp = layout.r;
            layout.r = layout.r0;
            layout.r0 = tmp;
        }

        return clipped;
    }
};

interface ElementCreator {
    (
        seriesModel: BarSeriesModel, data: List, newIndex: number,
        layout: RectLayout | SectorLayout, isHorizontalOrRadial: boolean,
        animationModel: BarSeriesModel,
        axisModel: CartesianAxisModel | AngleAxisModel | RadiusAxisModel,
        isUpdate: boolean,
        roundCap?: boolean
    ): BarPossiblePath
}

const elementCreator: {
    [key in 'polar' | 'cartesian2d']: ElementCreator
} = {

    cartesian2d(
        seriesModel, data, newIndex, layout: RectLayout, isHorizontal,
        animationModel, axisModel, isUpdate, roundCap
    ) {
        const rect = new Rect({
            shape: extend({}, layout),
            z2: 1
        });
        (rect as any).__dataIndex = newIndex;

        rect.name = 'item';

        if (animationModel) {
            const rectShape = rect.shape;
            const animateProperty = isHorizontal ? 'height' : 'width' as 'width' | 'height';
            rectShape[animateProperty] = 0;
        }
        return rect;
    },

    polar(
        seriesModel, data, newIndex, layout: SectorLayout, isRadial: boolean,
        animationModel, axisModel, isUpdate, roundCap
    ) {
        // Keep the same logic with bar in catesion: use end value to control
        // direction. Notice that if clockwise is true (by default), the sector
        // will always draw clockwisely, no matter whether endAngle is greater
        // or less than startAngle.
        const clockwise = layout.startAngle < layout.endAngle;

        const ShapeClass = (!isRadial && roundCap) ? Sausage : Sector;

        const sector = new ShapeClass({
            shape: defaults({clockwise: clockwise}, layout),
            z2: 1
        });

        sector.name = 'item';

        const positionMap = createPolarPositionMapping(isRadial);
        sector.calculateTextPosition = createSectorCalculateTextPosition<PolarBarLabelPosition>(positionMap);

        // Animation
        if (animationModel) {
            const sectorShape = sector.shape;
            const animateProperty = isRadial ? 'r' : 'endAngle' as 'r' | 'endAngle';
            const animateTarget = {} as SectorShape;
            sectorShape[animateProperty] = isRadial ? 0 : layout.startAngle;
            animateTarget[animateProperty] = layout[animateProperty];
            (isUpdate ? updateProps : initProps)(sector, {
                shape: animateTarget
                // __value: typeof dataValue === 'string' ? parseInt(dataValue, 10) : dataValue
            }, animationModel);
        }

        return sector;
    }
};

function shouldRealtimeSort(
    seriesModel: BarSeriesModel,
    coordSys: Cartesian2D | Polar
): RealtimeSortConfig {
    const realtimeSortOption = seriesModel.get('realtimeSort', true);
    const baseAxis = coordSys.getBaseAxis() as Axis2D;
    if (__DEV__) {
        if (realtimeSortOption) {
            if (baseAxis.type !== 'category') {
                warn('`realtimeSort` will not work because this bar series is not based on a category axis.');
            }
            if (coordSys.type !== 'cartesian2d') {
                warn('`realtimeSort` will not work because this bar series is not on cartesian2d.');
            }
        }
    }
    if (realtimeSortOption && baseAxis.type === 'category' && coordSys.type === 'cartesian2d') {
        return {
            baseAxis: baseAxis as Axis2D,
            otherAxis: coordSys.getOtherAxis(baseAxis)
        };
    }
}

function updateRealtimeAnimation(
    realtimeSortCfg: RealtimeSortConfig,
    seriesAnimationModel: BarSeriesModel,
    el: Rect,
    layout: LayoutRect,
    newIndex: number,
    isHorizontal: boolean,
    isUpdate: boolean,
    isChangeOrder: boolean
) {
    let seriesTarget;
    let axisTarget;
    if (isHorizontal) {
        axisTarget = {
            x: layout.x,
            width: layout.width
        };
        seriesTarget = {
            y: layout.y,
            height: layout.height
        };
    }
    else {
        axisTarget = {
            y: layout.y,
            height: layout.height
        };
        seriesTarget = {
            x: layout.x,
            width: layout.width
        };
    }

    if (!isChangeOrder) {
        // Keep the original growth animation if only axis order changed.
        // Not start a new animation.
        (isUpdate ? updateProps : initProps)(el, {
            shape: seriesTarget
        }, seriesAnimationModel, newIndex, null);
    }

    const axisAnimationModel = seriesAnimationModel ? realtimeSortCfg.baseAxis.model : null;
    (isUpdate ? updateProps : initProps)(el, {
        shape: axisTarget
    }, axisAnimationModel, newIndex);
}

function checkPropertiesNotValid<T extends Record<string, any>>(obj: T, props: readonly (keyof T)[]) {
    for (let i = 0; i < props.length; i++) {
        if (!isFinite(obj[props[i]])) {
            return true;
        }
    }
    return false;
}


const rectPropties = ['x', 'y', 'width', 'height'] as const;
const polarPropties = ['cx', 'cy', 'r', 'startAngle', 'endAngle'] as const;
const isValidLayout: Record<'cartesian2d' | 'polar', (layout: RectLayout | SectorLayout) => boolean> = {
    cartesian2d(layout: RectLayout) {
        return !checkPropertiesNotValid(layout, rectPropties);
    },

    polar(layout: SectorLayout) {
        return !checkPropertiesNotValid(layout, polarPropties);
    }
} as const;

interface GetLayout {
    (data: List, dataIndex: number, itemModel?: Model<BarDataItemOption>): RectLayout | SectorLayout
}
const getLayout: {
    [key in 'cartesian2d' | 'polar']: GetLayout
} = {
    // itemModel is only used to get borderWidth, which is not needed
    // when calculating bar background layout.
    cartesian2d(data, dataIndex, itemModel?): RectLayout {
        const layout = data.getItemLayout(dataIndex) as RectLayout;
        const fixedLineWidth = itemModel ? getLineWidth(itemModel, layout) : 0;

        // fix layout with lineWidth
        const signX = layout.width > 0 ? 1 : -1;
        const signY = layout.height > 0 ? 1 : -1;
        return {
            x: layout.x + signX * fixedLineWidth / 2,
            y: layout.y + signY * fixedLineWidth / 2,
            width: layout.width - signX * fixedLineWidth,
            height: layout.height - signY * fixedLineWidth
        };
    },

    polar(data, dataIndex, itemModel?): SectorLayout {
        const layout = data.getItemLayout(dataIndex);
        return {
            cx: layout.cx,
            cy: layout.cy,
            r0: layout.r0,
            r: layout.r,
            startAngle: layout.startAngle,
            endAngle: layout.endAngle
        } as SectorLayout;
    }
};

function isZeroOnPolar(layout: SectorLayout) {
    return layout.startAngle != null
        && layout.endAngle != null
        && layout.startAngle === layout.endAngle;
}

function createPolarPositionMapping(isRadial: boolean)
    : (position: PolarBarLabelPosition) => SectorTextPosition {
    return ((isRadial: boolean) => {
        const arcOrAngle = isRadial ? 'Arc' : 'Angle';
        return (position: PolarBarLabelPosition) => {
            switch (position) {
                case 'start':
                case 'insideStart':
                case 'end':
                case 'insideEnd':
                    return position + arcOrAngle as SectorTextPosition;
                default:
                    return position;
            }
        };
    })(isRadial);
}

function updateStyle(
    el: BarPossiblePath,
    data: List, dataIndex: number,
    itemModel: Model<BarDataItemOption>,
    layout: RectLayout | SectorLayout,
    seriesModel: BarSeriesModel,
    isHorizontalOrRadial: boolean,
    isPolar: boolean
) {
    const style = data.getItemVisual(dataIndex, 'style');

    if (!isPolar) {
        (el as Rect).setShape('r', itemModel.get(['itemStyle', 'borderRadius']) || 0);
    }

    el.useStyle(style);

    const cursorStyle = itemModel.getShallow('cursor');
    cursorStyle && (el as Path).attr('cursor', cursorStyle);

    const labelPositionOutside = isPolar
        ? (isHorizontalOrRadial
            ? ((layout as SectorLayout).r >= (layout as SectorLayout).r0 ? 'endArc' as const : 'startArc' as const)
            : ((layout as SectorLayout).endAngle >= (layout as SectorLayout).startAngle
                ? 'endAngle' as const
                : 'startAngle' as const
            )
        )
        : (isHorizontalOrRadial
            ? ((layout as RectLayout).height >= 0 ? 'bottom' as const : 'top' as const)
            : ((layout as RectLayout).width >= 0 ? 'right' as const : 'left' as const));

    const labelStatesModels = getLabelStatesModels(itemModel);

    setLabelStyle(
        el, labelStatesModels,
        {
            labelFetcher: seriesModel,
            labelDataIndex: dataIndex,
            defaultText: getDefaultLabel(seriesModel.getData(), dataIndex),
            inheritColor: style.fill as ColorString,
            defaultOpacity: style.opacity,
            defaultOutsidePosition: labelPositionOutside as BuiltinTextPosition
        }
    );

    const label = el.getTextContent();
    if (isPolar && label) {
        const position = itemModel.get(['label', 'position']);
        el.textConfig.inside = position === 'middle' ? true : null;
        setSectorTextRotation(
            el as Sector,
            position === 'outside' ? labelPositionOutside : position,
            createPolarPositionMapping(isHorizontalOrRadial),
            itemModel.get(['label', 'rotate'])
        );
    }

    setLabelValueAnimation(
        label,
        labelStatesModels,
        seriesModel.getRawValue(dataIndex) as ParsedValue,
        (value: number) => getDefaultInterpolatedLabel(data, value)
    );

    const emphasisModel = itemModel.getModel(['emphasis']);
    enableHoverEmphasis(el, emphasisModel.get('focus'), emphasisModel.get('blurScope'));
    setStatesStylesFromModel(el, itemModel);

    if (isZeroOnPolar(layout as SectorLayout)) {
        el.style.fill = 'none';
        el.style.stroke = 'none';
        each(el.states, (state) => {
            if (state.style) {
                state.style.fill = state.style.stroke = 'none';
            }
        });
    }
}

// In case width or height are too small.
function getLineWidth(
    itemModel: Model<BarDataItemOption>,
    rawLayout: RectLayout
) {
    // Has no border.
    const borderColor = itemModel.get(['itemStyle', 'borderColor']);
    if (!borderColor || borderColor === 'none') {
        return 0;
    }
    const lineWidth = itemModel.get(['itemStyle', 'borderWidth']) || 0;
    // width or height may be NaN for empty data
    const width = isNaN(rawLayout.width) ? Number.MAX_VALUE : Math.abs(rawLayout.width);
    const height = isNaN(rawLayout.height) ? Number.MAX_VALUE : Math.abs(rawLayout.height);
    return Math.min(lineWidth, width, height);
}

class LagePathShape {
    points: ArrayLike<number>;
}
interface LargePathProps extends PathProps {
    shape?: LagePathShape
}
class LargePath extends Path<LargePathProps> {
    type = 'largeBar';

    shape: LagePathShape;
;
    __startPoint: number[];
    __baseDimIdx: number;
    __largeDataIndices: ArrayLike<number>;
    __barWidth: number;

    constructor(opts?: LargePathProps) {
        super(opts);
    }

    getDefaultShape() {
        return new LagePathShape();
    }

    buildPath(ctx: CanvasRenderingContext2D, shape: LagePathShape) {
        // Drawing lines is more efficient than drawing
        // a whole line or drawing rects.
        const points = shape.points;
        const startPoint = this.__startPoint;
        const baseDimIdx = this.__baseDimIdx;

        for (let i = 0; i < points.length; i += 2) {
            startPoint[baseDimIdx] = points[i + baseDimIdx];
            ctx.moveTo(startPoint[0], startPoint[1]);
            ctx.lineTo(points[i], points[i + 1]);
        }
    }
}

function createLarge(
    seriesModel: BarSeriesModel,
    group: Group,
    incremental?: boolean
) {
    // TODO support polar
    const data = seriesModel.getData();
    const startPoint = [];
    const baseDimIdx = data.getLayout('valueAxisHorizontal') ? 1 : 0;
    startPoint[1 - baseDimIdx] = data.getLayout('valueAxisStart');

    const largeDataIndices = data.getLayout('largeDataIndices');
    const barWidth = data.getLayout('barWidth');

    const backgroundModel = seriesModel.getModel('backgroundStyle');
    const drawBackground = seriesModel.get('showBackground', true);

    if (drawBackground) {
        const points = data.getLayout('largeBackgroundPoints');
        const backgroundStartPoint: number[] = [];
        backgroundStartPoint[1 - baseDimIdx] = data.getLayout('backgroundStart');

        const bgEl = new LargePath({
            shape: {points: points},
            incremental: !!incremental,
            silent: true,
            z2: 0
        });
        bgEl.__startPoint = backgroundStartPoint;
        bgEl.__baseDimIdx = baseDimIdx;
        bgEl.__largeDataIndices = largeDataIndices;
        bgEl.__barWidth = barWidth;
        setLargeBackgroundStyle(bgEl, backgroundModel, data);
        group.add(bgEl);
    }

    const el = new LargePath({
        shape: {points: data.getLayout('largePoints')},
        incremental: !!incremental
    });
    el.__startPoint = startPoint;
    el.__baseDimIdx = baseDimIdx;
    el.__largeDataIndices = largeDataIndices;
    el.__barWidth = barWidth;
    group.add(el);
    setLargeStyle(el, seriesModel, data);

    // Enable tooltip and user mouse/touch event handlers.
    getECData(el).seriesIndex = seriesModel.seriesIndex;

    if (!seriesModel.get('silent')) {
        el.on('mousedown', largePathUpdateDataIndex);
        el.on('mousemove', largePathUpdateDataIndex);
    }
}

// Use throttle to avoid frequently traverse to find dataIndex.
const largePathUpdateDataIndex = throttle(function (this: LargePath, event: ZRElementEvent) {
    const largePath = this;
    const dataIndex = largePathFindDataIndex(largePath, event.offsetX, event.offsetY);
    getECData(largePath).dataIndex = dataIndex >= 0 ? dataIndex : null;
}, 30, false);

function largePathFindDataIndex(largePath: LargePath, x: number, y: number) {
    const baseDimIdx = largePath.__baseDimIdx;
    const valueDimIdx = 1 - baseDimIdx;
    const points = largePath.shape.points;
    const largeDataIndices = largePath.__largeDataIndices;
    const barWidthHalf = Math.abs(largePath.__barWidth / 2);
    const startValueVal = largePath.__startPoint[valueDimIdx];

    _eventPos[0] = x;
    _eventPos[1] = y;
    const pointerBaseVal = _eventPos[baseDimIdx];
    const pointerValueVal = _eventPos[1 - baseDimIdx];
    const baseLowerBound = pointerBaseVal - barWidthHalf;
    const baseUpperBound = pointerBaseVal + barWidthHalf;

    for (let i = 0, len = points.length / 2; i < len; i++) {
        const ii = i * 2;
        const barBaseVal = points[ii + baseDimIdx];
        const barValueVal = points[ii + valueDimIdx];
        if (
            barBaseVal >= baseLowerBound && barBaseVal <= baseUpperBound
            && (
                startValueVal <= barValueVal
                    ? (pointerValueVal >= startValueVal && pointerValueVal <= barValueVal)
                    : (pointerValueVal >= barValueVal && pointerValueVal <= startValueVal)
            )
        ) {
            return largeDataIndices[i];
        }
    }

    return -1;
}

function setLargeStyle(
    el: LargePath,
    seriesModel: BarSeriesModel,
    data: List
) {
    const globalStyle = data.getVisual('style');

    el.useStyle(extend({}, globalStyle));
    // Use stroke instead of fill.
    el.style.fill = null;
    el.style.stroke = globalStyle.fill;
    el.style.lineWidth = data.getLayout('barWidth');
}

function setLargeBackgroundStyle(
    el: LargePath,
    backgroundModel: Model<BarSeriesOption['backgroundStyle']>,
    data: List
) {
    const borderColor = backgroundModel.get('borderColor') || backgroundModel.get('color');
    const itemStyle = backgroundModel.getItemStyle();

    el.useStyle(itemStyle);
    el.style.fill = null;
    el.style.stroke = borderColor;
    el.style.lineWidth = data.getLayout('barWidth') as number;
}

function createBackgroundShape(
    isHorizontalOrRadial: boolean,
    layout: SectorLayout | RectLayout,
    coord: CoordSysOfBar
): SectorShape | RectShape {
    if (isCoordinateSystemType<Cartesian2D>(coord, 'cartesian2d')) {
        const rectShape = layout as RectShape;
        const coordLayout = coord.getArea();
        return {
            x: isHorizontalOrRadial ? rectShape.x : coordLayout.x,
            y: isHorizontalOrRadial ? coordLayout.y : rectShape.y,
            width: isHorizontalOrRadial ? rectShape.width : coordLayout.width,
            height: isHorizontalOrRadial ? coordLayout.height : rectShape.height
        } as RectShape;
    }
    else {
        const coordLayout = coord.getArea();
        const sectorShape = layout as SectorShape;
        return {
            cx: coordLayout.cx,
            cy: coordLayout.cy,
            r0: isHorizontalOrRadial ? coordLayout.r0 : sectorShape.r0,
            r: isHorizontalOrRadial ? coordLayout.r : sectorShape.r,
            startAngle: isHorizontalOrRadial ? sectorShape.startAngle : 0,
            endAngle: isHorizontalOrRadial ? sectorShape.endAngle : Math.PI * 2
        } as SectorShape;
    }
}

function createBackgroundEl(
    coord: CoordSysOfBar,
    isHorizontalOrRadial: boolean,
    layout: SectorLayout | RectLayout
): Rect | Sector {
    const ElementClz = coord.type === 'polar' ? Sector : Rect;
    return new ElementClz({
        shape: createBackgroundShape(isHorizontalOrRadial, layout, coord) as any,
        silent: true,
        z2: 0
    });
}

export default BarView;
