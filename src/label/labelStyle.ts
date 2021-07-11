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

import ZRText, { TextStyleProps } from 'zrender/src/graphic/Text';
import { Dictionary } from 'zrender/src/core/types';
import Element, { ElementTextConfig } from 'zrender/src/Element';
import Model from '../model/Model';
import {
    LabelOption,
    DisplayState,
    TextCommonOption,
    StatesOptionMixin,
    DisplayStateNonNormal,
    ColorString,
    ZRStyleProps,
    AnimationOptionMixin,
    InterpolatableValue,
    SeriesDataType
} from '../util/types';
import GlobalModel from '../model/Global';
import { isFunction, retrieve2, extend, keys, trim } from 'zrender/src/core/util';
import { SPECIAL_STATES, DISPLAY_STATES } from '../util/states';
import { deprecateReplaceLog } from '../util/log';
import { makeInner, interpolateRawValues } from '../util/model';
import List from '../data/List';
import { initProps, updateProps } from '../util/graphic';
import { getECData } from '../util/innerStore';

type TextCommonParams = {
    /**
     * Whether disable drawing box of block (outer most).
     */
    disableBox?: boolean
    /**
     * Specify a color when color is 'inherit',
     * If inheritColor specified, it is used as default textFill.
     */
    inheritColor?: ColorString

    /**
     * Specify a opacity when opacity is not given.
     */
    defaultOpacity?: number

    defaultOutsidePosition?: LabelOption['position']

    /**
     * If support legacy 'auto' for 'inherit' usage.
     */
    // supportLegacyAuto?: boolean

    textStyle?: ZRStyleProps
};
const EMPTY_OBJ = {};

interface SetLabelStyleOpt<TLabelDataIndex> extends TextCommonParams {
    defaultText?: string | ((
        labelDataIndex: TLabelDataIndex,
        opt: SetLabelStyleOpt<TLabelDataIndex>,
        interpolatedValue?: InterpolatableValue
    ) => string);
    // Fetch text by:
    // opt.labelFetcher.getFormattedLabel(
    //     opt.labelDataIndex, 'normal'/'emphasis', null, opt.labelDimIndex, opt.labelProp
    // )
    labelFetcher?: {
        getFormattedLabel: (
            // In MapDraw case it can be string (region name)
            labelDataIndex: TLabelDataIndex,
            status: DisplayState,
            dataType?: string,
            labelDimIndex?: number,
            formatter?: string | ((params: object) => string),
            // If provided, the implementation of `getFormattedLabel` can use it
            // to generate the final label text.
            extendParams?: {
                interpolatedValue: InterpolatableValue
            }
        ) => string;
    };
    labelDataIndex?: TLabelDataIndex;
    labelDimIndex?: number;

    /**
     * Inject a setter of text for the text animation case.
     */
    enableTextSetter?: boolean
}
type LabelModel = Model<LabelOption & {
    formatter?: string | ((params: any) => string);
    showDuringLabel?: boolean // Currently only supported by line charts
}>;
type LabelModelForText = Model<Omit<
    // Remove
    LabelOption, 'position' | 'rotate'> & {
        formatter?: string | ((params: any) => string);
    }>;

type LabelStatesModels<LabelModel> = Partial<Record<DisplayStateNonNormal, LabelModel>> & {normal: LabelModel};

export function setLabelText(label: ZRText, labelTexts: Record<DisplayState, string>) {
    for (let i = 0; i < SPECIAL_STATES.length; i++) {
        const stateName = SPECIAL_STATES[i];
        const text = labelTexts[stateName];
        const state = label.ensureState(stateName);
        state.style = state.style || {};
        state.style.text = text;
    }

    const oldStates = label.currentStates.slice();
    label.clearStates(true);
    label.setStyle({ text: labelTexts.normal });
    label.useStates(oldStates, true);
}

function getLabelText<TLabelDataIndex>(
    opt: SetLabelStyleOpt<TLabelDataIndex>,
    stateModels: LabelStatesModels<LabelModel>,
    interpolatedValue?: InterpolatableValue
): Record<DisplayState, string> {
    const labelFetcher = opt.labelFetcher;
    const labelDataIndex = opt.labelDataIndex;
    const labelDimIndex = opt.labelDimIndex;
    const normalModel = stateModels.normal;
    let baseText;
    if (labelFetcher) {
        baseText = labelFetcher.getFormattedLabel(
            labelDataIndex, 'normal',
            null,
            labelDimIndex,
            normalModel && normalModel.get('formatter'),
            interpolatedValue != null ? {
                interpolatedValue: interpolatedValue
            } : null
        );
    }
    if (baseText == null) {
        baseText = isFunction(opt.defaultText)
            ? opt.defaultText(labelDataIndex, opt, interpolatedValue)
            : opt.defaultText;
    }

    const statesText = {
        normal: baseText
    } as Record<DisplayState, string>;

    for (let i = 0; i < SPECIAL_STATES.length; i++) {
        const stateName = SPECIAL_STATES[i];
        const stateModel = stateModels[stateName];
        statesText[stateName] = retrieve2(labelFetcher
            ? labelFetcher.getFormattedLabel(
                labelDataIndex,
                stateName,
                null,
                labelDimIndex,
                stateModel && stateModel.get('formatter')
            )
            : null, baseText);
    }
    return statesText;
}
/**
 * Set normal styles and emphasis styles about text on target element
 * If target is a ZRText. It will create a new style object.
 * If target is other Element. It will create or reuse ZRText which is attached on the target.
 * And create a new style object.
 *
 * NOTICE: Because the style on ZRText will be replaced with new(only x, y are keeped).
 * So please update the style on ZRText after use this method.
 */
// eslint-disable-next-line
function setLabelStyle<TLabelDataIndex>(
    targetEl: ZRText,
    labelStatesModels: LabelStatesModels<LabelModelForText>,
    opt?: SetLabelStyleOpt<TLabelDataIndex>,
    stateSpecified?: Partial<Record<DisplayState, TextStyleProps>>
): void;
// eslint-disable-next-line
function setLabelStyle<TLabelDataIndex>(
    targetEl: Element,
    labelStatesModels: LabelStatesModels<LabelModel>,
    opt?: SetLabelStyleOpt<TLabelDataIndex>,
    stateSpecified?: Partial<Record<DisplayState, TextStyleProps>>
): void;
function setLabelStyle<TLabelDataIndex>(
    targetEl: Element,
    labelStatesModels: LabelStatesModels<LabelModel>,
    opt?: SetLabelStyleOpt<TLabelDataIndex>,
    stateSpecified?: Partial<Record<DisplayState, TextStyleProps>>
    // TODO specified position?
) {
    opt = opt || EMPTY_OBJ;
    const isSetOnText = targetEl instanceof ZRText;
    let needsCreateText = false;
    for (let i = 0; i < DISPLAY_STATES.length; i++) {
        const stateModel = labelStatesModels[DISPLAY_STATES[i]];
        if (stateModel && stateModel.getShallow('show')) {
            needsCreateText = true;
            break;
        }
    }
    let textContent = isSetOnText ? targetEl as ZRText : targetEl.getTextContent();
    if (needsCreateText) {
        if (!isSetOnText) {
            // Reuse the previous
            if (!textContent) {
                textContent = new ZRText();
                targetEl.setTextContent(textContent);
            }
            // Use same state proxy
            if (targetEl.stateProxy) {
                textContent.stateProxy = targetEl.stateProxy;
            }
        }
        const labelStatesTexts = getLabelText(opt, labelStatesModels);

        const normalModel = labelStatesModels.normal;
        const showNormal = !!normalModel.getShallow('show');
        const normalStyle = createTextStyle(
            normalModel, stateSpecified && stateSpecified.normal, opt, false, !isSetOnText
        );
        normalStyle.text = labelStatesTexts.normal;
        if (!isSetOnText) {
            // Always create new
            targetEl.setTextConfig(createTextConfig(normalModel, opt, false));
        }

        for (let i = 0; i < SPECIAL_STATES.length; i++) {
            const stateName = SPECIAL_STATES[i];
            const stateModel = labelStatesModels[stateName];

            if (stateModel) {
                const stateObj = textContent.ensureState(stateName);
                const stateShow = !!retrieve2(stateModel.getShallow('show'), showNormal);
                if (stateShow !== showNormal) {
                    stateObj.ignore = !stateShow;
                }
                stateObj.style = createTextStyle(
                    stateModel, stateSpecified && stateSpecified[stateName], opt, true, !isSetOnText
                );
                stateObj.style.text = labelStatesTexts[stateName];

                if (!isSetOnText) {
                    const targetElEmphasisState = targetEl.ensureState(stateName);
                    targetElEmphasisState.textConfig = createTextConfig(stateModel, opt, true);
                }
            }
        }

        // PENDING: if there is many requirements that emphasis position
        // need to be different from normal position, we might consider
        // auto slient is those cases.
        textContent.silent = !!normalModel.getShallow('silent');
        // Keep x and y
        if (textContent.style.x != null) {
            normalStyle.x = textContent.style.x;
        }
        if (textContent.style.y != null) {
            normalStyle.y = textContent.style.y;
        }
        textContent.ignore = !showNormal;
        // Always create new style.
        textContent.useStyle(normalStyle);
        textContent.dirty();

        if (opt.enableTextSetter) {
            labelInner(textContent).setLabelText = function (interpolatedValue: InterpolatableValue) {
                const labelStatesTexts = getLabelText(opt, labelStatesModels, interpolatedValue);
                setLabelText(textContent, labelStatesTexts);
            };
        }
    }
    else if (textContent) {
        // Not display rich text.
        textContent.ignore = true;
    }
    targetEl.dirty();
}
export { setLabelStyle };

export function getLabelStatesModels<LabelName extends string = 'label'>(
    itemModel: Model<StatesOptionMixin<any> & Partial<Record<LabelName, any>>>,
    labelName?: LabelName
): Record<DisplayState, LabelModel> {
    labelName = (labelName || 'label') as LabelName;
    const statesModels = {
        normal: itemModel.getModel(labelName) as LabelModel
    } as Record<DisplayState, LabelModel>;
    for (let i = 0; i < SPECIAL_STATES.length; i++) {
        const stateName = SPECIAL_STATES[i];
        statesModels[stateName] = itemModel.getModel([stateName, labelName]);
    }
    return statesModels;
}
/**
 * Set basic textStyle properties.
 */
export function createTextStyle(
    textStyleModel: Model,
    specifiedTextStyle?: TextStyleProps, // Fixed style in the code. Can't be set by model.
    opt?: Pick<TextCommonParams, 'inheritColor' | 'disableBox'>,
    isNotNormal?: boolean,
    isAttached?: boolean // If text is attached on an element. If so, auto color will handling in zrender.
) {
    const textStyle: TextStyleProps = {};
    setTextStyleCommon(textStyle, textStyleModel, opt, isNotNormal, isAttached);
    specifiedTextStyle && extend(textStyle, specifiedTextStyle);
    // textStyle.host && textStyle.host.dirty && textStyle.host.dirty(false);
    return textStyle;
}
export function createTextConfig(
    textStyleModel: Model,
    opt?: Pick<TextCommonParams, 'defaultOutsidePosition' | 'inheritColor'>,
    isNotNormal?: boolean
) {
    opt = opt || {};
    const textConfig: ElementTextConfig = {};
    let labelPosition;
    let labelRotate = textStyleModel.getShallow('rotate');
    const labelDistance = retrieve2(textStyleModel.getShallow('distance'), isNotNormal ? null : 5);
    const labelOffset = textStyleModel.getShallow('offset');
    labelPosition = textStyleModel.getShallow('position')
        || (isNotNormal ? null : 'inside');
    // 'outside' is not a valid zr textPostion value, but used
    // in bar series, and magric type should be considered.
    labelPosition === 'outside' && (labelPosition = opt.defaultOutsidePosition || 'top');
    if (labelPosition != null) {
        textConfig.position = labelPosition;
    }
    if (labelOffset != null) {
        textConfig.offset = labelOffset;
    }
    if (labelRotate != null) {
        labelRotate *= Math.PI / 180;
        textConfig.rotation = labelRotate;
    }
    if (labelDistance != null) {
        textConfig.distance = labelDistance;
    }
    // fill and auto is determined by the color of path fill if it's not specified by developers.
    textConfig.outsideFill = textStyleModel.get('color') === 'inherit'
        ? (opt.inheritColor || null)
        : 'auto';
    return textConfig;
}
/**
 * The uniform entry of set text style, that is, retrieve style definitions
 * from `model` and set to `textStyle` object.
 *
 * Never in merge mode, but in overwrite mode, that is, all of the text style
 * properties will be set. (Consider the states of normal and emphasis and
 * default value can be adopted, merge would make the logic too complicated
 * to manage.)
 */
function setTextStyleCommon(
    textStyle: TextStyleProps,
    textStyleModel: Model,
    opt?: Pick<TextCommonParams, 'inheritColor' | 'defaultOpacity' | 'disableBox'>,
    isNotNormal?: boolean,
    isAttached?: boolean
) {
    // Consider there will be abnormal when merge hover style to normal style if given default value.
    opt = opt || EMPTY_OBJ;
    const ecModel = textStyleModel.ecModel;
    const globalTextStyle = ecModel && ecModel.option.textStyle;
    // Consider case:
    // {
    //     data: [{
    //         value: 12,
    //         label: {
    //             rich: {
    //                 // no 'a' here but using parent 'a'.
    //             }
    //         }
    //     }],
    //     rich: {
    //         a: { ... }
    //     }
    // }
    const richItemNames = getRichItemNames(textStyleModel);
    let richResult: TextStyleProps['rich'];
    if (richItemNames) {
        richResult = {};
        for (const name in richItemNames) {
            if (richItemNames.hasOwnProperty(name)) {
                // Cascade is supported in rich.
                const richTextStyle = textStyleModel.getModel(['rich', name]);
                // In rich, never `disableBox`.
                // FIXME: consider `label: {formatter: '{a|xx}', color: 'blue', rich: {a: {}}}`,
                // the default color `'blue'` will not be adopted if no color declared in `rich`.
                // That might confuses users. So probably we should put `textStyleModel` as the
                // root ancestor of the `richTextStyle`. But that would be a break change.
                setTokenTextStyle(
                    richResult[name] = {}, richTextStyle, globalTextStyle, opt, isNotNormal, isAttached, false, true
                );
            }
        }
    }
    if (richResult) {
        textStyle.rich = richResult;
    }
    const overflow = textStyleModel.get('overflow');
    if (overflow) {
        textStyle.overflow = overflow;
    }
    const margin = textStyleModel.get('minMargin');
    if (margin != null) {
        textStyle.margin = margin;
    }
    const ellipsis = textStyleModel.get('ellipsis');
    if (ellipsis) {
        textStyle.ellipsis = ellipsis;
    }
    textStyle.lineOverflow = textStyleModel.get('lineOverflow');
    setTokenTextStyle(textStyle, textStyleModel, globalTextStyle, opt, isNotNormal, isAttached, true, false);
}
// Consider case:
// {
//     data: [{
//         value: 12,
//         label: {
//             rich: {
//                 // no 'a' here but using parent 'a'.
//             }
//         }
//     }],
//     rich: {
//         a: { ... }
//     }
// }
// TODO TextStyleModel
function getRichItemNames(textStyleModel: Model<LabelOption>) {
    // Use object to remove duplicated names.
    let richItemNameMap: Dictionary<number>;
    while (textStyleModel && textStyleModel !== textStyleModel.ecModel) {
        const rich = (textStyleModel.option || EMPTY_OBJ as LabelOption).rich;
        if (rich) {
            richItemNameMap = richItemNameMap || {};
            const richKeys = keys(rich);
            for (let i = 0; i < richKeys.length; i++) {
                const richKey = richKeys[i];
                richItemNameMap[richKey] = 1;
            }
        }
        textStyleModel = textStyleModel.parentModel;
    }
    return richItemNameMap;
}
const TEXT_PROPS_WITH_GLOBAL = [
    'fontStyle', 'fontWeight', 'fontSize', 'fontFamily',
    'textShadowColor', 'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY'
] as const;
const TEXT_PROPS_SELF = [
    'align', 'lineHeight', 'width', 'height', 'tag', 'verticalAlign'
] as const;
const TEXT_PROPS_BOX = [
    'padding', 'borderWidth', 'borderRadius', 'borderDashOffset',
    'backgroundColor', 'borderColor',
    'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'
] as const;

function setTokenTextStyle(
    textStyle: TextStyleProps['rich'][string],
    textStyleModel: Model<LabelOption>,
    globalTextStyle: LabelOption,
    opt?: Pick<TextCommonParams, 'inheritColor' | 'defaultOpacity' | 'disableBox'>,
    isNotNormal?: boolean,
    isAttached?: boolean,
    isBlock?: boolean,
    inRich?: boolean
) {
    // In merge mode, default value should not be given.
    globalTextStyle = !isNotNormal && globalTextStyle || EMPTY_OBJ;
    const inheritColor = opt && opt.inheritColor;
    let fillColor = textStyleModel.getShallow('color');
    let strokeColor = textStyleModel.getShallow('textBorderColor');
    let opacity = retrieve2(textStyleModel.getShallow('opacity'), globalTextStyle.opacity);
    if (fillColor === 'inherit' || fillColor === 'auto') {
        if (__DEV__) {
            if (fillColor === 'auto') {
                deprecateReplaceLog('color: \'auto\'', 'color: \'inherit\'');
            }
        }
        if (inheritColor) {
            fillColor = inheritColor;
        }
        else {
            fillColor = null;
        }
    }
    if (strokeColor === 'inherit' || (strokeColor === 'auto')) {
        if (__DEV__) {
            if (strokeColor === 'auto') {
                deprecateReplaceLog('color: \'auto\'', 'color: \'inherit\'');
            }
        }
        if (inheritColor) {
            strokeColor = inheritColor;
        }
        else {
            strokeColor = null;
        }
    }
    if (!isAttached) {
        // Only use default global textStyle.color if text is individual.
        // Otherwise it will use the strategy of attached text color because text may be on a path.
        fillColor = fillColor || globalTextStyle.color;
        strokeColor = strokeColor || globalTextStyle.textBorderColor;
    }
    if (fillColor != null) {
        textStyle.fill = fillColor;
    }
    if (strokeColor != null) {
        textStyle.stroke = strokeColor;
    }
    const textBorderWidth = retrieve2(textStyleModel.getShallow('textBorderWidth'), globalTextStyle.textBorderWidth);
    if (textBorderWidth != null) {
        textStyle.lineWidth = textBorderWidth;
    }
    const textBorderType = retrieve2(textStyleModel.getShallow('textBorderType'), globalTextStyle.textBorderType);
    if (textBorderType != null) {
        textStyle.lineDash = textBorderType as any;
    }
    const textBorderDashOffset = retrieve2(
        textStyleModel.getShallow('textBorderDashOffset'), globalTextStyle.textBorderDashOffset
    );
    if (textBorderDashOffset != null) {
        textStyle.lineDashOffset = textBorderDashOffset;
    }

    if (!isNotNormal && (opacity == null) && !inRich) {
        opacity = opt && opt.defaultOpacity;
    }
    if (opacity != null) {
        textStyle.opacity = opacity;
    }

    // TODO
    if (!isNotNormal && !isAttached) {
        // Set default finally.
        if (textStyle.fill == null && opt.inheritColor) {
            textStyle.fill = opt.inheritColor;
        }
    }
    // Do not use `getFont` here, because merge should be supported, where
    // part of these properties may be changed in emphasis style, and the
    // others should remain their original value got from normal style.
    for (let i = 0; i < TEXT_PROPS_WITH_GLOBAL.length; i++) {
        const key = TEXT_PROPS_WITH_GLOBAL[i];
        const val = retrieve2(textStyleModel.getShallow(key), globalTextStyle[key]);
        if (val != null) {
            (textStyle as any)[key] = val;
        }
    }
    for (let i = 0; i < TEXT_PROPS_SELF.length; i++) {
        const key = TEXT_PROPS_SELF[i];
        const val = textStyleModel.getShallow(key);
        if (val != null) {
            (textStyle as any)[key] = val;
        }
    }
    if (textStyle.verticalAlign == null) {
        const baseline = textStyleModel.getShallow('baseline');
        if (baseline != null) {
            textStyle.verticalAlign = baseline;
        }
    }
    if (!isBlock || !opt.disableBox) {
        for (let i = 0; i < TEXT_PROPS_BOX.length; i++) {
            const key = TEXT_PROPS_BOX[i];
            const val = textStyleModel.getShallow(key);
            if (val != null) {
                (textStyle as any)[key] = val;
            }
        }

        const borderType = textStyleModel.getShallow('borderType');
        if (borderType != null) {
            textStyle.borderDash = borderType as any;
        }

        if ((textStyle.backgroundColor === 'auto' || textStyle.backgroundColor === 'inherit') && inheritColor) {
            if (__DEV__) {
                if (textStyle.backgroundColor === 'auto') {
                    deprecateReplaceLog('backgroundColor: \'auto\'', 'backgroundColor: \'inherit\'');
                }
            }
            textStyle.backgroundColor = inheritColor;
        }
        if ((textStyle.borderColor === 'auto' || textStyle.borderColor === 'inherit') && inheritColor) {
            if (__DEV__) {
                if (textStyle.borderColor === 'auto') {
                    deprecateReplaceLog('borderColor: \'auto\'', 'borderColor: \'inherit\'');
                }
            }
            textStyle.borderColor = inheritColor;
        }
    }
}

export function getFont(
    opt: Pick<TextCommonOption, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>,
    ecModel: GlobalModel
) {
    const gTextStyleModel = ecModel && ecModel.getModel('textStyle');
    return trim([
        // FIXME in node-canvas fontWeight is before fontStyle
        opt.fontStyle || gTextStyleModel && gTextStyleModel.getShallow('fontStyle') || '',
        opt.fontWeight || gTextStyleModel && gTextStyleModel.getShallow('fontWeight') || '',
        (opt.fontSize || gTextStyleModel && gTextStyleModel.getShallow('fontSize') || 12) + 'px',
        opt.fontFamily || gTextStyleModel && gTextStyleModel.getShallow('fontFamily') || 'sans-serif'
    ].join(' '));
}

export const labelInner = makeInner<{
    /**
     * Previous target value stored used for label.
     * It's mainly for text animation
     */
    prevValue?: InterpolatableValue
    /**
     * Target value stored used for label.
     */
    value?: InterpolatableValue
    /**
     * Current value in text animation.
     */
    interpolatedValue?: InterpolatableValue
    /**
     * If enable value animation
     */
    valueAnimation?: boolean
    /**
     * Label value precision during animation.
     */
    precision?: number | 'auto'

    /**
     * If enable value animation
     */
    statesModels?: LabelStatesModels<LabelModelForText>
    /**
     * Default text getter during interpolation
     */
    defaultInterpolatedText?: (value: InterpolatableValue) => string
    /**
     * Change label text from interpolated text during animation
     */
    setLabelText?: (interpolatedValue?: InterpolatableValue) => void

}, ZRText>();

export function setLabelValueAnimation(
    label: ZRText,
    labelStatesModels: LabelStatesModels<LabelModelForText>,
    value: InterpolatableValue,
    getDefaultText: (value: InterpolatableValue) => string
) {
    if (!label) {
        return;
    }

    const obj = labelInner(label);
    obj.prevValue = obj.value;
    obj.value = value;
    const normalLabelModel = labelStatesModels.normal;

    obj.valueAnimation = normalLabelModel.get('valueAnimation');

    if (obj.valueAnimation) {
        obj.precision = normalLabelModel.get('precision');
        obj.defaultInterpolatedText = getDefaultText;
        obj.statesModels = labelStatesModels;
    }
}

export function animateLabelValue(
    textEl: ZRText,
    dataIndex: number,
    data: List,
    animatableModel: Model<AnimationOptionMixin>,
    labelFetcher: SetLabelStyleOpt<number>['labelFetcher']
) {
    const labelInnerStore = labelInner(textEl);
    if (!labelInnerStore.valueAnimation) {
        return;
    }
    const defaultInterpolatedText = labelInnerStore.defaultInterpolatedText;
    // Consider the case that being animating, do not use the `obj.value`,
    // Otherwise it will jump to the `obj.value` when this new animation started.
    const currValue = retrieve2(labelInnerStore.interpolatedValue, labelInnerStore.prevValue);
    const targetValue = labelInnerStore.value;

    function during(percent: number) {
        const interpolated = interpolateRawValues(
            data,
            labelInnerStore.precision,
            currValue,
            targetValue,
            percent
        );

        labelInnerStore.interpolatedValue = percent === 1 ? null : interpolated;

        const labelText = getLabelText({
            labelDataIndex: dataIndex,
            labelFetcher: labelFetcher,
            defaultText: defaultInterpolatedText
                ? defaultInterpolatedText(interpolated)
                : interpolated + ''
        }, labelInnerStore.statesModels, interpolated);

        setLabelText(textEl, labelText);
    }

    (labelInnerStore.prevValue == null
        ? initProps
        : updateProps
    )(textEl, {}, animatableModel, dataIndex, null, during);
}
