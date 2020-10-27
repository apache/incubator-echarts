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

import {
    Dictionary, TooltipRenderMode, ColorString,
    TooltipOrderMode, DimensionType
} from '../../util/types';
import {
    TooltipMarkerType, getTooltipMarker, encodeHTML,
    makeValueReadable, convertToColorString
} from '../../util/format';
import { isString, each, hasOwn, isArray, map, assert, extend } from 'zrender/src/core/util';
import { SortOrderComparator } from '../../data/helper/dataValueHelper';
import SeriesModel from '../../model/Series';
import { getRandomIdBase } from '../../util/number';
import Model from '../../model/Model';
import { TooltipOption } from './TooltipModel';


const TOOLTIP_NAME_TEXT_STYLE_CSS = 'font-size:12px;color:#6e7079';
const TOOLTIP_TEXT_STYLE_RICH = {
    fontSize: 12,
    fill: '#6e7079'
};
const TOOLTIP_VALUE_TEXT_STYLE_CSS = 'font-size:14px;color:#464646;font-weight:900';
const TOOLTIP_VALUE_TEXT_STYLE_RICH = {
    fontSize: 14,
    fill: '#464646',
    fontWeight: 900
};
const TOOLTIP_LINE_HEIGHT_CSS = 'line-height:1';

// 0: no gap in this block.
// 1: has max gap in level 1 in this block.
// ...
type GapLevel = number;
// See `TooltipMarkupLayoutIntent['innerGapLevel']`.
// (value from UI design)
const HTML_GAPS: { [key in GapLevel]: number } = [0, 10, 20, 30];
const RICH_TEXT_GAPS: { [key in GapLevel]: string } = ['', '\n', '\n\n', '\n\n\n'];

/**
 * This is an abstract layer to insulate the upper usage of tooltip content
 * from the different backends according to different `renderMode` ('html' or 'richText').
 * With the help of the abstract layer, it does not need to consider how to create and
 * assemble html or richText snippets when making tooltip content.
 *
 * @usage
 *
 * ```ts
 * class XxxSeriesModel {
 *     formatTooltip(
 *         dataIndex: number,
 *         multipleSeries: boolean,
 *         dataType: string
 *     ) {
 *         ...
 *         return createTooltipMarkup('section', {
 *             header: header,
 *             blocks: [
 *                 createTooltipMarkup('nameValue', {
 *                     name: name,
 *                     value: value,
 *                     noValue: value == null
 *                 })
 *             ]
 *         });
 *     }
 * }
 * ```
 */
export type TooltipMarkupBlockFragment =
    TooltipMarkupSection
    | TooltipMarkupNameValueBlock;

interface TooltipMarkupBlock {
    // Use to make comparison when `sortBlocks: true`.
    sortParam?: unknown;
    __gapLevelBetweenSubBlocks?: number;
}

export interface TooltipMarkupSection extends TooltipMarkupBlock {
    type: 'section';
    header?: unknown;
    // If `noHeader` is `true`, do not display header.
    // Otherwise, always display it even if it is
    // null/undefined/NaN/''... (displayed as '-').
    noHeader?: boolean;
    blocks?: TooltipMarkupBlockFragment[];
    // Enable to sort blocks when making final html or richText.
    sortBlocks?: boolean;
}

export interface TooltipMarkupNameValueBlock extends TooltipMarkupBlock {
    type: 'nameValue';
    // If `!markerType`, tooltip marker is not used.
    markerType?: TooltipMarkerType;
    markerColor?: ColorString;
    name?: string;
    // Also support value is `[121, 555, 94.2]`.
    value?: unknown | unknown[];
    // If not specified, treat value as normal string or numeric.
    // If needs to display formatted time, set as 'time'.
    // If needs to display original string with numeric guessing, set as 'ordinal'.
    // If both `value` and `valueType` are array, each valueType[i] cooresponds to value[i].
    valueType?: DimensionType | DimensionType[];
    // If `noName` or `noValue` is `true`, do not display name or value.
    // Otherwise, always display them even if they are
    // null/undefined/NaN/''... (displayed as '-').
    noName?: boolean;
    noValue?: boolean;
}

/**
 * Create tooltip markup by this function, we can get TS type check.
 */
// eslint-disable-next-line max-len
export function createTooltipMarkup(type: 'section', option: Omit<TooltipMarkupSection, 'type'>): TooltipMarkupSection;
// eslint-disable-next-line max-len
export function createTooltipMarkup(type: 'nameValue', option: Omit<TooltipMarkupNameValueBlock, 'type'>): TooltipMarkupNameValueBlock;
// eslint-disable-next-line max-len
export function createTooltipMarkup(type: TooltipMarkupBlockFragment['type'], option: Omit<TooltipMarkupBlockFragment, 'type'>): TooltipMarkupBlockFragment {
    (option as TooltipMarkupBlockFragment).type = type;
    return option as TooltipMarkupBlockFragment;
}


// Can be null/undefined, which means generate nothing markup text.
type MarkupText = string;
interface TooltipMarkupFragmentBuilder {
    planLayout(
        fragment: TooltipMarkupBlockFragment
    ): void;
    build(
        ctx: TooltipMarkupBuildContext,
        fragment: TooltipMarkupBlockFragment,
        topMarginForOuterGap: number
    ): MarkupText;
}

function getBuilder(fragment: TooltipMarkupBlockFragment): TooltipMarkupFragmentBuilder {
    return hasOwn(builderMap, fragment.type) && builderMap[fragment.type];
}

const builderMap: { [key in TooltipMarkupBlockFragment['type']]: TooltipMarkupFragmentBuilder } = {

    /**
     * A `section` block is like:
     * ```
     * header
     * subBlock
     * subBlock
     * ...
     * ```
     */
    section: {
        planLayout: function (fragment: TooltipMarkupSection) {
            const subBlockLen = fragment.blocks.length;
            const thisBlockHasInnerGap = subBlockLen > 1 || (subBlockLen > 0 && !fragment.noHeader);

            let thisGapLevelBetweenSubBlocks = 0;
            each(fragment.blocks, function (subBlock) {
                getBuilder(subBlock).planLayout(subBlock);
                const subGapLevel = subBlock.__gapLevelBetweenSubBlocks;

                // If the some of the sub-blocks have some gaps (like 10px) inside, this block
                // should use a larger gap (like 20px) to distinguish those sub-blocks.
                if (subGapLevel >= thisGapLevelBetweenSubBlocks) {
                    thisGapLevelBetweenSubBlocks = subGapLevel + (
                        (
                            thisBlockHasInnerGap && (
                                // 0 always can not be readable gap level.
                                !subGapLevel
                                // If no header, always keep the sub gap level. Otherwise
                                // look weird in case `multipleSeries`.
                                || (subBlock.type === 'section' && !subBlock.noHeader)
                            )
                        ) ? 1 : 0
                    );
                }
            });
            fragment.__gapLevelBetweenSubBlocks = thisGapLevelBetweenSubBlocks;
        },

        build(ctx, fragment: TooltipMarkupSection, topMarginForOuterGap): string {
            const noHeader = fragment.noHeader;
            const gaps = getGap(fragment);

            const subMarkupText = buildSubBlocks(
                ctx,
                fragment,
                noHeader ? topMarginForOuterGap : gaps.html
            );

            if (noHeader) {
                return subMarkupText;
            }

            const displayableHeader = makeValueReadable(fragment.header, 'ordinal');
            if (ctx.renderMode === 'richText') {
                return wrapInlineNameRichText(ctx, displayableHeader) + gaps.richText
                    + subMarkupText;
            }
            else {
                return wrapBlockHTML(
                    `<div style="${TOOLTIP_NAME_TEXT_STYLE_CSS};${TOOLTIP_LINE_HEIGHT_CSS};">`
                        + encodeHTML(displayableHeader)
                        + '</div>'
                        + subMarkupText,
                    topMarginForOuterGap
                );
            }
        }
    },

    /**
     * A `nameValue` block is like:
     * ```
     * marker  name  value
     * ```
     */
    nameValue: {
        planLayout: function (fragment: TooltipMarkupNameValueBlock) {
            fragment.__gapLevelBetweenSubBlocks = 0;
        },

        build(ctx, fragment: TooltipMarkupNameValueBlock, topMarginForOuterGap) {
            const renderMode = ctx.renderMode;
            const noName = fragment.noName;
            const noValue = fragment.noValue;
            const noMarker = !fragment.markerType;
            const name = fragment.name;
            const value = fragment.value;

            if (noName && noValue) {
                return;
            }

            const markerStr = noMarker
                ? ''
                : ctx.markupStyleCreator.makeTooltipMarker(
                    fragment.markerType,
                    fragment.markerColor || '#333',
                    renderMode
                );
            const readableName = noName
                ? ''
                : makeValueReadable(name, 'ordinal');
            const valueTypeOption = fragment.valueType;
            const readableValueList = noValue
                ? []
                : (isArray(value)
                    ? map(value, (val, idx) => makeValueReadable(
                        val, isArray(valueTypeOption) ? valueTypeOption[idx] : valueTypeOption
                    ))
                    : [makeValueReadable(
                        value, isArray(valueTypeOption) ? valueTypeOption[0] : valueTypeOption
                    )]
                );
            const valueAlignRight = !noMarker || !noName;
            // It little weird if only value next to marker but far from marker.
            const valueCloseToMarker = !noMarker && noName;

            return renderMode === 'richText'
                ? (
                    (noMarker ? '' : markerStr)
                    + (noName ? '' : wrapInlineNameRichText(ctx, readableName))
                    // Value has commas inside, so use ' ' as delimiter for multiple values.
                    + (noValue ? '' : wrapInlineValueRichText(
                        ctx, readableValueList, valueAlignRight, valueCloseToMarker
                    ))
                )
                : wrapBlockHTML(
                    (noMarker ? '' : markerStr)
                    + (noName ? '' : wrapInlineNameHTML(readableName, !noMarker))
                    + (noValue ? '' : wrapInlineValueHTML(
                        readableValueList, valueAlignRight, valueCloseToMarker
                    )),
                    topMarginForOuterGap
                );
        }
    }
};


function buildSubBlocks(
    ctx: TooltipMarkupBuildContext,
    fragment: TooltipMarkupSection,
    topMarginForOuterGap: number
): MarkupText {
    const subMarkupTextList: string[] = [];
    let subBlocks = fragment.blocks || [];
    assert(!subBlocks || isArray(subBlocks));
    subBlocks = subBlocks || [];

    const orderMode = ctx.orderMode;
    if (fragment.sortBlocks && orderMode) {
        subBlocks = subBlocks.slice();
        const orderMap = { valueAsc: 'asc', valueDesc: 'desc' } as const;
        if (hasOwn(orderMap, orderMode)) {
            const comparator = new SortOrderComparator(orderMap[orderMode as 'valueAsc' | 'valueDesc'], null);
            subBlocks.sort((a, b) => comparator.evaluate(a.sortParam, b.sortParam));
        }
        // FIXME 'seriesDesc' necessary?
        else if (orderMode === 'seriesDesc') {
            subBlocks.reverse();
        }
    }

    const gaps = getGap(fragment);
    each(subBlocks, function (subBlock, idx) {
        const subMarkupText = getBuilder(subBlock).build(
            ctx,
            subBlock,
            idx > 0 ? gaps.html : 0
        );
        subMarkupText != null && subMarkupTextList.push(subMarkupText);
    });

    if (!subMarkupTextList.length) {
        return;
    }

    return ctx.renderMode === 'richText'
        ? subMarkupTextList.join(gaps.richText)
        : wrapBlockHTML(
            subMarkupTextList.join(''),
            topMarginForOuterGap
        );
}

interface TooltipMarkupBuildContext {
    renderMode: TooltipRenderMode;
    orderMode: TooltipOrderMode;
    markupStyleCreator: TooltipMarkupStyleCreator;
}

/**
 * @return markupText. null/undefined means no content.
 */
export function buildTooltipMarkup(
    fragment: TooltipMarkupBlockFragment,
    markupStyleCreator: TooltipMarkupStyleCreator,
    renderMode: TooltipRenderMode,
    orderMode: TooltipOrderMode
): MarkupText {
    if (!fragment) {
        return;
    }

    const builder = getBuilder(fragment);
    builder.planLayout(fragment);
    const ctx: TooltipMarkupBuildContext = {
        renderMode: renderMode,
        orderMode: orderMode,
        markupStyleCreator: markupStyleCreator
    };
    return builder.build(ctx, fragment, 0);
}


function getGap(fragment: TooltipMarkupBlock): {
    html: number;
    richText: string
} {
    const gapLevelBetweenSubBlocks = fragment.__gapLevelBetweenSubBlocks;
    return {
        html: HTML_GAPS[gapLevelBetweenSubBlocks],
        richText: RICH_TEXT_GAPS[gapLevelBetweenSubBlocks]
    };
}

function wrapBlockHTML(
    encodedContent: string,
    topGap: number
): string {
    const clearfix = '<div style="clear:both"></div>';
    const marginCSS = `margin: ${topGap}px 0 0`;
    return `<div style="${marginCSS};${TOOLTIP_LINE_HEIGHT_CSS};">`
        + encodedContent + clearfix
        + '</div>';
}

function wrapInlineNameHTML(name: string, leftHasMarker: boolean): string {
    const marginCss = leftHasMarker ? 'margin-left:2px' : '';
    return `<span style="${TOOLTIP_NAME_TEXT_STYLE_CSS};${marginCss}">`
        + encodeHTML(name)
        + '</span>';
}

function wrapInlineValueHTML(valueList: string[], alignRight: boolean, valueCloseToMarker: boolean): string {
    // Do not too close to marker, considering there are multiple values separated by spaces.
    const paddingStr = valueCloseToMarker ? '10px' : '20px';
    const alignCSS = alignRight ? `float:right;margin-left:${paddingStr}` : '';
    return (
        `<span style="${alignCSS};${TOOLTIP_VALUE_TEXT_STYLE_CSS}">`
        // Value has commas inside, so use '  ' as delimiter for multiple values.
        + map(valueList, value => encodeHTML(value)).join('&nbsp;&nbsp;')
        + '</span>'
    );
}

function wrapInlineNameRichText(ctx: TooltipMarkupBuildContext, name: string): string {
    return ctx.markupStyleCreator.wrapRichTextStyle(name, TOOLTIP_TEXT_STYLE_RICH);
}

function wrapInlineValueRichText(
    ctx: TooltipMarkupBuildContext,
    valueList: string[],
    alignRight: boolean,
    valueCloseToMarker: boolean
): string {
    const styles: Dictionary<unknown>[] = [TOOLTIP_VALUE_TEXT_STYLE_RICH];
    const paddingLeft = valueCloseToMarker ? 10 : 20;
    alignRight && styles.push({ padding: [0, 0, 0, paddingLeft], align: 'right' });
    // Value has commas inside, so use '  ' as delimiter for multiple values.
    return ctx.markupStyleCreator.wrapRichTextStyle(valueList.join('  '), styles);
}


export function retrieveVisualColorForTooltipMarker(
    series: SeriesModel,
    dataIndex: number
): ColorString {
    const style = series.getData().getItemVisual(dataIndex, 'style');
    const color = style[series.visualDrawType];
    return convertToColorString(color);
}

export function getPaddingFromTooltipModel(
    model: Model<TooltipOption>,
    renderMode: TooltipRenderMode
): number | number[] {
    const padding = model.get('padding');
    return padding != null
        ? padding
        // We give slightly different to look pretty.
        : renderMode === 'richText'
        ? [8, 10]
        : 10;
}

/**
 * The major feature is generate styles for `renderMode: 'richText'`.
 * But it also serves `renderMode: 'html'` to provide
 * "renderMode-independent" API.
 */
export class TooltipMarkupStyleCreator {
    readonly richTextStyles: Dictionary<Dictionary<unknown>> = {};

    // Notice that "generate a style name" usuall happens repeatly when mouse moving and
    // displaying a tooltip. So we put the `_nextStyleNameId` as a member of each creator
    // rather than static shared by all creators (which will cause it increase to fast).
    private _nextStyleNameId: number = getRandomIdBase();

    private _generateStyleName() {
        return '__EC_aUTo_' + this._nextStyleNameId++;
    }

    makeTooltipMarker(
        markerType: TooltipMarkerType,
        colorStr: ColorString,
        renderMode: TooltipRenderMode
    ): string {
        const markerId = renderMode === 'richText'
            ? this._generateStyleName()
            : null;
        const marker = getTooltipMarker({
            color: colorStr,
            type: markerType,
            renderMode,
            markerId: markerId,
            size: "10px"
        });
        if (isString(marker)) {
            return marker;
        }
        else {
            if (__DEV__) {
                assert(markerId);
            }
            this.richTextStyles[markerId] = marker.style;
            return marker.content;
        }
    }

    /**
     * @usage
     * ```ts
     * const styledText = markupStyleCreator.wrapRichTextStyle([
     *     // The styles will be auto merged.
     *     {
     *         fontSize: 12,
     *         color: 'blue'
     *     },
     *     {
     *         padding: 20
     *     }
     * ]);
     * ```
     */
    wrapRichTextStyle(text: string, styles: Dictionary<unknown> | Dictionary<unknown>[]): string {
        const finalStl = {};
        if (isArray(styles)) {
            each(styles, stl => extend(finalStl, stl));
        }
        else {
            extend(finalStl, styles);
        }
        const styleName = this._generateStyleName();
        this.richTextStyles[styleName] = finalStl;
        return `{${styleName}|${text}}`;
    }
}
