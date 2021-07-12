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

import Displayable from 'zrender/src/graphic/Displayable';
import { ImageStyleProps } from 'zrender/src/graphic/Image';
import { PathProps, PathStyleProps } from 'zrender/src/graphic/Path';
import { ZRenderType } from 'zrender/src/zrender';
import { BarGridLayoutOptionForCustomSeries, BarGridLayoutResult } from '../../layout/barGrid';
import {
    BlurScope,
    CallbackDataParams,
    ColorByMixin,
    Dictionary,
    DimensionLoose,
    ItemStyleOption,
    LabelOption,
    OptionDataValue,
    OrdinalRawValue,
    ParsedValue,
    SeriesDataType,
    SeriesEncodeOptionMixin,
    SeriesOnCalendarOptionMixin,
    SeriesOnCartesianOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesOnSingleOptionMixin,
    SeriesOption,
    TextCommonOption,
    ZRStyleProps
} from '../../util/types';
import Element, { ElementProps } from 'zrender/src/Element';
import List, { DefaultDataVisual } from '../../data/List';
import GlobalModel from '../../model/Global';
import createListFromArray from '../helper/createListFromArray';
import { makeInner } from '../../util/model';
import { CoordinateSystem } from '../../coord/CoordinateSystem';
import SeriesModel from '../../model/Series';
import {
    Arc,
    BezierCurve,
    Circle,
    CompoundPath,
    Ellipse,
    Line,
    Polygon,
    Polyline,
    Rect,
    Ring,
    Sector
} from '../../util/graphic';
import { TextStyleProps } from 'zrender/src/graphic/Text';


export interface LooseElementProps extends ElementProps {
    style?: ZRStyleProps;
    shape?: Dictionary<unknown>;
}

export type CustomExtraElementInfo = Dictionary<unknown>;
export const TRANSFORM_PROPS = {
    x: 1,
    y: 1,
    scaleX: 1,
    scaleY: 1,
    originX: 1,
    originY: 1,
    rotation: 1
} as const;
export type TransformProp = keyof typeof TRANSFORM_PROPS;

// Also compat with ec4, where
// `visual('color') visual('borderColor')` is supported.
export const STYLE_VISUAL_TYPE = {
    color: 'fill',
    borderColor: 'stroke'
} as const;
export type StyleVisualProps = keyof typeof STYLE_VISUAL_TYPE;

export const NON_STYLE_VISUAL_PROPS = {
    symbol: 1,
    symbolSize: 1,
    symbolKeepAspect: 1,
    legendIcon: 1,
    visualMeta: 1,
    liftZ: 1,
    decal: 1
} as const;
export type NonStyleVisualProps = keyof typeof NON_STYLE_VISUAL_PROPS;

// Do not declare "Dictionary" in TransitionAnyOption to restrict the type check.
export type TransitionAnyOption = {
    transition?: TransitionAnyProps;
    enterFrom?: Dictionary<unknown>;
    leaveTo?: Dictionary<unknown>;
};
type TransitionAnyProps = string | string[];
type TransitionTransformOption = {
    transition?: ElementRootTransitionProp | ElementRootTransitionProp[];
    enterFrom?: Dictionary<unknown>;
    leaveTo?: Dictionary<unknown>;
};
type ElementRootTransitionProp = TransformProp | 'shape' | 'extra' | 'style';
type ShapeMorphingOption = {
    /**
     * If do shape morphing animation when type is changed.
     * Only available on path.
     */
    morph?: boolean
};

export interface CustomBaseDuringAPI {
    // Usually other props do not need to be changed in animation during.
    setTransform(key: TransformProp, val: number): this
    getTransform(key: TransformProp): number;
    setExtra(key: string, val: unknown): this
    getExtra(key: string): unknown
}
export interface CustomDuringAPI<
    StyleOpt extends any = any,
    ShapeOpt extends any = any
> extends CustomBaseDuringAPI {
    setShape<T extends keyof ShapeOpt>(key: T, val: ShapeOpt[T]): this;
    getShape<T extends keyof ShapeOpt>(key: T): ShapeOpt[T];
    setStyle<T extends keyof StyleOpt>(key: T, val: StyleOpt[T]): this
    getStyle<T extends keyof StyleOpt>(key: T): StyleOpt[T];
};


export interface CustomBaseElementOption extends Partial<Pick<
    Element, TransformProp | 'silent' | 'ignore' | 'textConfig'
>>, TransitionTransformOption {
    // element type, required.
    type: string;
    id?: string;
    // For animation diff.
    name?: string;
    info?: CustomExtraElementInfo;
    // `false` means remove the textContent.
    textContent?: CustomTextOption | false;
    // `false` means remove the clipPath
    clipPath?: CustomBaseZRPathOption | false;
    // `extra` can be set in any el option for custom prop for annimation duration.
    extra?: Dictionary<unknown> & TransitionAnyOption;
    // updateDuringAnimation
    during?(params: CustomBaseDuringAPI): void;

    focus?: 'none' | 'self' | 'series' | ArrayLike<number>
    blurScope?: BlurScope
};

export interface CustomDisplayableOption extends CustomBaseElementOption, Partial<Pick<
    Displayable, 'zlevel' | 'z' | 'z2' | 'invisible'
>> {
    style?: ZRStyleProps & TransitionAnyOption;
    during?(params: CustomDuringAPI): void;
    /**
     * @deprecated
     */
    // `false` means remove emphasis trigger.
    styleEmphasis?: ZRStyleProps | false;
    emphasis?: CustomDisplayableOptionOnState;
    blur?: CustomDisplayableOptionOnState;
    select?: CustomDisplayableOptionOnState;
}
export interface CustomDisplayableOptionOnState extends Partial<Pick<
    Displayable, TransformProp | 'textConfig' | 'z2'
>> {
    // `false` means remove emphasis trigger.
    style?: (ZRStyleProps & TransitionAnyOption) | false;


    during?(params: CustomDuringAPI): void;
}
export interface CustomGroupOption extends CustomBaseElementOption {
    type: 'group';
    width?: number;
    height?: number;
    // @deprecated
    diffChildrenByName?: boolean;
    children: CustomChildElementOption[];
    $mergeChildren?: false | 'byName' | 'byIndex';
}
export interface CustomBaseZRPathOption<T extends PathProps['shape'] = PathProps['shape']>
    extends CustomDisplayableOption, ShapeMorphingOption {
    autoBatch?: boolean;
    shape?: T & TransitionAnyOption;
    style?: PathProps['style']
    during?(params: CustomDuringAPI<PathStyleProps, T>): void;
}

interface BuiltinShapes {
    'circle': Circle['shape']
    'rect': Rect['shape']
    'sector': Sector['shape']
    'poygon': Polygon['shape']
    'polyline': Polyline['shape']
    'line': Line['shape']
    'arc': Arc['shape']
    'bezierCurve': BezierCurve['shape']
    'ring': Ring['shape']
    'ellipse': Ellipse['shape'],
    'compoundPath': CompoundPath['shape']
}

interface CustomSVGPathShapeOption {
    // SVG Path, like 'M0,0 L0,-20 L70,-1 L70,0 Z'
    pathData?: string;
    // "d" is the alias of `pathData` follows the SVG convention.
    d?: string;
    layout?: 'center' | 'cover';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
export interface CustomSVGPathOption extends CustomBaseZRPathOption<CustomSVGPathShapeOption> {
    type: 'path';
}

interface CustomBuitinPathOption<T extends keyof BuiltinShapes>
    extends CustomBaseZRPathOption<BuiltinShapes[T]> {
    type: T
}
type CreateCustomBuitinPathOption<T extends keyof BuiltinShapes> = T extends any
    ? CustomBuitinPathOption<T> : never;

export type CustomPathOption = CreateCustomBuitinPathOption<keyof BuiltinShapes>
    | CustomSVGPathOption;

export interface CustomImageOptionOnState extends CustomDisplayableOptionOnState {
    style?: ImageStyleProps & TransitionAnyOption;
}
export interface CustomImageOption extends CustomDisplayableOption {
    type: 'image';
    style?: ImageStyleProps & TransitionAnyOption;
    emphasis?: CustomImageOptionOnState;
    blur?: CustomImageOptionOnState;
    select?: CustomImageOptionOnState;
}

export interface CustomTextOptionOnState extends CustomDisplayableOptionOnState {
    style?: TextStyleProps & TransitionAnyOption;
}
export interface CustomTextOption extends CustomDisplayableOption {
    type: 'text';
    style?: TextStyleProps & TransitionAnyOption;
    emphasis?: CustomTextOptionOnState;
    blur?: CustomTextOptionOnState;
    select?: CustomTextOptionOnState;
}

export type CustomElementOption = CustomPathOption
    | CustomImageOption
    | CustomTextOption
    | CustomGroupOption;

// Can only set focus, blur on the root element.
export type CustomChildElementOption = Omit<CustomElementOption, 'focus' | 'blurScope'>;

export type CustomElementOptionOnState = CustomDisplayableOptionOnState
    | CustomImageOptionOnState;

export interface CustomSeriesRenderItemAPI extends
        CustomSeriesRenderItemCoordinateSystemAPI {

    // Methods from ExtensionAPI.
    // NOTE: Not using Pick<ExtensionAPI> here because we don't want to bundle ExtensionAPI into the d.ts
    getWidth(): number
    getHeight(): number
    getZr(): ZRenderType
    getDevicePixelRatio(): number

    value(dim: DimensionLoose, dataIndexInside?: number): ParsedValue;
    ordinalRawValue(dim: DimensionLoose, dataIndexInside?: number): ParsedValue | OrdinalRawValue;
    style(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    styleEmphasis(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    visual<VT extends NonStyleVisualProps | StyleVisualProps>(
        visualType: VT,
        dataIndexInside?: number
    ): VT extends NonStyleVisualProps ? DefaultDataVisual[VT]
        : VT extends StyleVisualProps ? PathStyleProps[typeof STYLE_VISUAL_TYPE[VT]]
        : void;
    barLayout(opt: BarGridLayoutOptionForCustomSeries): BarGridLayoutResult;
    currentSeriesIndices(): number[];
    font(opt: Pick<TextCommonOption, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>): string;
}
export interface CustomSeriesRenderItemParamsCoordSys {
    type: string;
    // And extra params for each coordinate systems.
}
export interface CustomSeriesRenderItemCoordinateSystemAPI {
    coord(
        data: OptionDataValue | OptionDataValue[],
        clamp?: boolean
    ): number[];
    size?(
        dataSize: OptionDataValue | OptionDataValue[],
        dataItem: OptionDataValue | OptionDataValue[]
    ): number | number[];
}

export type WrapEncodeDefRet = Dictionary<number[]>;

export interface CustomSeriesRenderItemParams {
    context: Dictionary<unknown>;
    dataIndex: number;
    seriesId: string;
    seriesName: string;
    seriesIndex: number;
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    encode: WrapEncodeDefRet;

    dataIndexInside: number;
    dataInsideLength: number;

    actionType?: string;
}
type CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
) => CustomElementOption;

interface CustomSeriesStateOption {
    itemStyle?: ItemStyleOption;
    label?: LabelOption;
}

export interface CustomSeriesOption extends
    ColorByMixin,
    SeriesOption<never>,    // don't support StateOption in custom series.
    SeriesEncodeOptionMixin,
    SeriesOnCartesianOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesOnSingleOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnCalendarOptionMixin {

    type?: 'custom'

    // If set as 'none', do not depends on coord sys.
    coordinateSystem?: string | 'none';

    renderItem?: CustomSeriesRenderItem;

    // Only works on polar and cartesian2d coordinate system.
    clip?: boolean;
}

export interface LegacyCustomSeriesOption extends SeriesOption<CustomSeriesStateOption>, CustomSeriesStateOption {}

export const customInnerStore = makeInner<{
    info: CustomExtraElementInfo;
    customPathData: string;
    customGraphicType: string;
    customImagePath: CustomImageOption['style']['image'];
    // customText: string;
    txConZ2Set: number;
    leaveToProps: ElementProps;
    option: CustomElementOption;
    userDuring: CustomBaseElementOption['during'];
}, Element>();

export default class CustomSeriesModel extends SeriesModel<CustomSeriesOption> {

    static type = 'series.custom';
    readonly type = CustomSeriesModel.type;

    static dependencies = ['grid', 'polar', 'geo', 'singleAxis', 'calendar'];

    // preventAutoZ = true;

    currentZLevel: number;
    currentZ: number;

    static defaultOption: CustomSeriesOption = {
        coordinateSystem: 'cartesian2d', // Can be set as 'none'
        zlevel: 0,
        z: 2,
        legendHoverLink: true,

        // Custom series will not clip by default.
        // Some case will use custom series to draw label
        // For example https://echarts.apache.org/examples/en/editor.html?c=custom-gantt-flight
        clip: false

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Polar coordinate system
        // polarIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,
    };

    optionUpdated() {
        this.currentZLevel = this.get('zlevel', true);
        this.currentZ = this.get('z', true);
    }

    getInitialData(option: CustomSeriesOption, ecModel: GlobalModel): List {
        return createListFromArray(this.getSource(), this);
    }

    getDataParams(dataIndex: number, dataType?: SeriesDataType, el?: Element): CallbackDataParams & {
        info: CustomExtraElementInfo
    } {
        const params = super.getDataParams(dataIndex, dataType) as ReturnType<CustomSeriesModel['getDataParams']>;
        el && (params.info = customInnerStore(el).info);
        return params;
    }
}

export type PrepareCustomInfo = (coordSys: CoordinateSystem) => {
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    api: CustomSeriesRenderItemCoordinateSystemAPI
};
