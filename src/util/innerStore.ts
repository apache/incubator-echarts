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

import Element from 'zrender/src/Element';
import {
    DataModel, ECEventData, BlurScope, InnerFocus, SeriesDataType,
    ComponentMainType, ComponentItemTooltipOption
} from './types';
import { makeInner } from './model';
/**
 * ECData stored on graphic element
 */
export interface ECData {
    dataIndex?: number;
    dataModel?: DataModel;
    eventData?: ECEventData;
    seriesIndex?: number;
    dataType?: SeriesDataType;
    focus?: InnerFocus;
    blurScope?: BlurScope;

    // Required by `tooltipConfig` and `focus`.
    componentMainType?: ComponentMainType;
    componentIndex?: number;
    componentHighDownName?: string;

    // To make a tooltipConfig, seach `setTooltipConfig`.
    // Used to find component tooltip option, which is used as
    // the parent of tooltipConfig.option for cascading.
    // If not provided, do not use component as its parent.
    // (Set manatary to make developers not to forget them).
    tooltipConfig?: {
        // Target item name to locate tooltip.
        name: string;
        option: ComponentItemTooltipOption<unknown>;
    };
}

export const getECData = makeInner<ECData, Element>();

export const setCommonECData = (seriesIndex: number, dataType: SeriesDataType, dataIdx: number, el: Element) => {
    if (el) {
        const ecData = getECData(el);
        // Add data index and series index for indexing the data by element
        // Useful in tooltip
        ecData.dataIndex = dataIdx;
        ecData.dataType = dataType;
        ecData.seriesIndex = seriesIndex;

        // TODO: not store dataIndex on children.
        if (el.type === 'group') {
            el.traverse(function (child: Element): void {
                const childECData = getECData(child);
                childECData.seriesIndex = seriesIndex;
                childECData.dataIndex = dataIdx;
                childECData.dataType = dataType;
            });
        }
    }
};
