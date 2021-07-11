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

import * as zrUtil from 'zrender/src/core/util';
import ExtensionAPI from '../../core/ExtensionAPI';
import { ZRenderType } from 'zrender/src/zrender';
import { TooltipOption } from './TooltipModel';
import { ZRColor } from '../../util/types';
import Model from '../../model/Model';
import ZRText, { TextStyleProps } from 'zrender/src/graphic/Text';
import { TooltipMarkupStyleCreator, getPaddingFromTooltipModel } from './tooltipMarkup';
import { throwError } from '../../util/log';

class TooltipRichContent {

    private _zr: ZRenderType;

    private _show = false;

    private _styleCoord: [number, number, number, number] = [0, 0, 0, 0];

    private _hideTimeout: number;

    private _enterable = true;

    private _inContent: boolean;

    private _hideDelay: number;

    el: ZRText;

    constructor(api: ExtensionAPI) {
        this._zr = api.getZr();
        makeStyleCoord(this._styleCoord, this._zr, api.getWidth() / 2, api.getHeight() / 2);
    }

    /**
     * Update when tooltip is rendered
     */
    update(tooltipModel: Model<TooltipOption>) {
        const alwaysShowContent = tooltipModel.get('alwaysShowContent');
        alwaysShowContent && this._moveIfResized();
    }

    show() {
        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
        }

        this.el.show();
        this._show = true;
    }

    /**
     * Set tooltip content
     */
    setContent(
        content: string | HTMLElement | HTMLElement[],
        markupStyleCreator: TooltipMarkupStyleCreator,
        tooltipModel: Model<TooltipOption>,
        borderColor: ZRColor,
        arrowPosition: TooltipOption['position']
    ) {
        if (zrUtil.isObject(content)) {
            throwError(__DEV__ ? 'Passing DOM nodes as content is not supported in richText tooltip!' : '');
        }
        if (this.el) {
            this._zr.remove(this.el);
        }

        const textStyleModel = tooltipModel.getModel('textStyle');

        this.el = new ZRText({
            style: {
                rich: markupStyleCreator.richTextStyles,
                text: content as string,
                lineHeight: 22,
                backgroundColor: tooltipModel.get('backgroundColor'),
                borderRadius: tooltipModel.get('borderRadius'),
                borderWidth: 1,
                borderColor: borderColor as string,
                shadowColor: tooltipModel.get('shadowColor'),
                shadowBlur: tooltipModel.get('shadowBlur'),
                shadowOffsetX: tooltipModel.get('shadowOffsetX'),
                shadowOffsetY: tooltipModel.get('shadowOffsetY'),
                textShadowColor: textStyleModel.get('textShadowColor'),
                textShadowBlur: textStyleModel.get('textShadowBlur') || 0,
                textShadowOffsetX: textStyleModel.get('textShadowOffsetX') || 0,
                textShadowOffsetY: textStyleModel.get('textShadowOffsetY') || 0,
                fill: tooltipModel.get(['textStyle', 'color']),
                padding: getPaddingFromTooltipModel(tooltipModel, 'richText'),
                verticalAlign: 'top',
                align: 'left'
            },
            z: tooltipModel.get('z')
        });
        this._zr.add(this.el);

        const self = this;
        this.el.on('mouseover', function () {
            // clear the timeout in hideLater and keep showing tooltip
            if (self._enterable) {
                clearTimeout(self._hideTimeout);
                self._show = true;
            }
            self._inContent = true;
        });
        this.el.on('mouseout', function () {
            if (self._enterable) {
                if (self._show) {
                    self.hideLater(self._hideDelay);
                }
            }
            self._inContent = false;
        });
    }

    setEnterable(enterable?: boolean) {
        this._enterable = enterable;
    }

    getSize() {
        const el = this.el;
        const bounding = this.el.getBoundingRect();
        // bounding rect does not include shadow. For renderMode richText,
        // if overflow, it will be cut. So calculate them accurately.
        const shadowOuterSize = calcShadowOuterSize(el.style);
        return [
            bounding.width + shadowOuterSize.left + shadowOuterSize.right,
            bounding.height + shadowOuterSize.top + shadowOuterSize.bottom
        ];
    }

    moveTo(x: number, y: number) {
        const el = this.el;
        if (el) {
            const styleCoord = this._styleCoord;
            makeStyleCoord(styleCoord, this._zr, x, y);
            x = styleCoord[0];
            y = styleCoord[1];
            const style = el.style;
            const borderWidth = mathMaxWith0(style.borderWidth || 0);
            const shadowOuterSize = calcShadowOuterSize(style);
            // rich text x, y do not include border.
            el.x = x + borderWidth + shadowOuterSize.left;
            el.y = y + borderWidth + shadowOuterSize.top;
            el.markRedraw();
        }
    }


    /**
     * when `alwaysShowContent` is true,
     * move the tooltip after chart resized
     */
    _moveIfResized() {
        // The ratio of left to width
        const ratioX = this._styleCoord[2];
        // The ratio of top to height
        const ratioY = this._styleCoord[3];
        this.moveTo(
            ratioX * this._zr.getWidth(),
            ratioY * this._zr.getHeight()
        );
    }

    hide() {
        if (this.el) {
            this.el.hide();
        }
        this._show = false;
    }

    hideLater(time?: number) {
        if (this._show && !(this._inContent && this._enterable)) {
            if (time) {
                this._hideDelay = time;
                // Set show false to avoid invoke hideLater multiple times
                this._show = false;
                this._hideTimeout = setTimeout(zrUtil.bind(this.hide, this), time) as any;
            }
            else {
                this.hide();
            }
        }
    }

    isShow() {
        return this._show;
    }

    getOuterSize() {
        const size = this.getSize();
        return {
            width: size[0],
            height: size[1]
        };
    }

    dispose() {
        this._zr.remove(this.el);
    }
}

function mathMaxWith0(val: number): number {
    return Math.max(0, val);
}

function calcShadowOuterSize(style: TextStyleProps) {
    const shadowBlur = mathMaxWith0(style.shadowBlur || 0);
    const shadowOffsetX = mathMaxWith0(style.shadowOffsetX || 0);
    const shadowOffsetY = mathMaxWith0(style.shadowOffsetY || 0);
    return {
        left: mathMaxWith0(shadowBlur - shadowOffsetX),
        right: mathMaxWith0(shadowBlur + shadowOffsetX),
        top: mathMaxWith0(shadowBlur - shadowOffsetY),
        bottom: mathMaxWith0(shadowBlur + shadowOffsetY)
    };
}

function makeStyleCoord(out: number[], zr: ZRenderType, zrX: number, zrY: number) {
    out[0] = zrX;
    out[1] = zrY;
    out[2] = out[0] / zr.getWidth();
    out[3] = out[1] / zr.getHeight();
}

export default TooltipRichContent;
