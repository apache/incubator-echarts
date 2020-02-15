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

import MapDraw from '../helper/MapDraw';
import * as echarts from '../../echarts';

export default echarts.extendComponentView({

    type: 'geo',

    init: function (ecModel, api) {
        var mapDraw = new MapDraw(api, true);
        this._mapDraw = mapDraw;

        this.group.add(mapDraw.group);
    },

    render: function (geoModel, ecModel, api, payload) {
        // Not render if it is an toggleSelect action from self
        if (payload && payload.type === 'geoToggleSelect'
            && payload.from === this.uid
        ) {
            return;
        }

        if (geoModel.get('show')) {
            if (this._mapDraw.hasDraw) {
                this._mapDraw.group.show();
            }
            else {
                this._mapDraw.draw(geoModel, ecModel, api, this, payload);
                this._mapDraw.hasDraw = true;
            }
        }
        else {
            this._mapDraw.group.hide();
        }

        this.group.silent = geoModel.get('silent');
    },

    dispose: function () {
        this._mapDraw && this._mapDraw.remove();
    }

});