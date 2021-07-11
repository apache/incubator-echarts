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

import ComponentModel from '../../model/Component';
import {
    ComponentOption,
    LabelOption,
    LineStyleOption,
    CommonTooltipOption,
    TooltipRenderMode,
    CallbackDataParams,
    TooltipOrderMode
} from '../../util/types';
import {AxisPointerOption} from '../axisPointer/AxisPointerModel';


export type TopLevelFormatterParams = CallbackDataParams | CallbackDataParams[];

export interface TooltipOption extends CommonTooltipOption<TopLevelFormatterParams>, ComponentOption {
    mainType?: 'tooltip'

    axisPointer?: AxisPointerOption & {
        axis?: 'auto' | 'x' | 'y' | 'angle' | 'radius'
        crossStyle?: LineStyleOption & {
            // TODO
            textStyle?: LabelOption
        }
    }
    /**
     * If show popup content
     */
    showContent?: boolean
    /**
     * Trigger only works on coordinate system.
     */
    trigger?: 'item' | 'axis' | 'none'

    displayMode?: 'single' | 'multipleByCoordSys';

    /**
     * 'auto': use html by default, and use non-html if `document` is not defined
     * 'html': use html for tooltip
     * 'richText': use canvas, svg, and etc. for tooltip
     */
    renderMode?: 'auto' | TooltipRenderMode   // TODO richText renamed canvas?

    /**
     * If append popup dom to document.body
     * Only available when renderMode is html
     */
    appendToBody?: boolean

    /**
     * specified class name of tooltip dom
     * Only available when renderMode is html
     */
    className?: string

    order?: TooltipOrderMode
}

class TooltipModel extends ComponentModel<TooltipOption> {
    static type = 'tooltip' as const;
    type = TooltipModel.type;

    static dependencies = ['axisPointer'];

    static defaultOption: TooltipOption = {
        zlevel: 0,

        z: 60,

        show: true,

        // tooltip main content
        showContent: true,

        // 'trigger' only works on coordinate system.
        // 'item' | 'axis' | 'none'
        trigger: 'item',

        // 'click' | 'mousemove' | 'none'
        triggerOn: 'mousemove|click',

        alwaysShowContent: false,

        displayMode: 'single', // 'single' | 'multipleByCoordSys'

        renderMode: 'auto', // 'auto' | 'html' | 'richText'

        // whether restraint content inside viewRect.
        // If renderMode: 'richText', default true.
        // If renderMode: 'html', defaut false (for backward compat).
        confine: null,

        showDelay: 0,

        hideDelay: 100,

        // Animation transition time, unit is second
        transitionDuration: 0.4,

        enterable: false,

        backgroundColor: '#fff',

        // box shadow
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, .2)',
        shadowOffsetX: 1,
        shadowOffsetY: 2,

        // tooltip border radius, unit is px, default is 4
        borderRadius: 4,

        // tooltip border width, unit is px, default is 0 (no border)
        borderWidth: 1,

        // Tooltip inside padding, default is 5 for all direction
        // Array is allowed to set up, right, bottom, left, same with css
        // The default value: See `tooltip/tooltipMarkup.ts#getPaddingFromTooltipModel`.
        padding: null,

        // Extra css text
        extraCssText: '',

        // axis indicator, trigger by axis
        axisPointer: {
            // default is line
            // legal values: 'line' | 'shadow' | 'cross'
            type: 'line',

            // Valid when type is line, appoint tooltip line locate on which line. Optional
            // legal values: 'x' | 'y' | 'angle' | 'radius' | 'auto'
            // default is 'auto', chose the axis which type is category.
            // for multiply y axis, cartesian coord chose x axis, polar chose angle axis
            axis: 'auto',

            animation: 'auto',
            animationDurationUpdate: 200,
            animationEasingUpdate: 'exponentialOut',

            crossStyle: {
                color: '#999',
                width: 1,
                type: 'dashed',

                // TODO formatter
                textStyle: {}
            }

            // lineStyle and shadowStyle should not be specified here,
            // otherwise it will always override those styles on option.axisPointer.
        },
        textStyle: {
            color: '#666',
            fontSize: 14,
            lineOverflow: 'truncate'
        }
    };
}

export default TooltipModel;
