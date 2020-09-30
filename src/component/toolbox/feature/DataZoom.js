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

import * as echarts from '../../../echarts';
import * as zrUtil from 'zrender/src/core/util';
import BrushController from '../../helper/BrushController';
import BrushTargetManager from '../../helper/BrushTargetManager';
import * as history from '../../dataZoom/history';
import sliderMove from '../../helper/sliderMove';
import lang from '../../../lang';
import * as featureManager from '../featureManager';

// Use dataZoomSelect
import '../../dataZoomSelect';

var dataZoomLang = lang.toolbox.dataZoom;
var each = zrUtil.each;

// Spectial component id start with \0ec\0, see echarts/model/Global.js~hasInnerId
var DATA_ZOOM_ID_BASE = '\0_ec_\0toolbox-dataZoom_';

function DataZoom(model, ecModel, api) {

    /**
     * @private
     * @type {module:echarts/component/helper/BrushController}
     */
    (this._brushController = new BrushController(api.getZr()))
        .on('brush', zrUtil.bind(this._onBrush, this))
        .mount();

    /**
     * @private
     * @type {boolean}
     */
    this._isZoomActive;
}

DataZoom.defaultOption = {
    show: true,
    filterMode: 'filter',
    // Icon group
    icon: {
        zoom: 'M0,13.5h26.9 M13.5,26.9V0 M32.1,13.5H58V58H13.5 V32.1',
        back: 'M22,1.4L9.9,13.5l12.3,12.3 M10.3,13.5H54.9v44.6 H10.3v-26'
    },
    // `zoom`, `back`
    title: zrUtil.clone(dataZoomLang.title),
    brushStyle: {
        borderWidth: 0,
        color: 'rgba(0,0,0,0.2)'
    }
};

var proto = DataZoom.prototype;

proto.render = function (featureModel, ecModel, api, payload) {
    this.model = featureModel;
    this.ecModel = ecModel;
    this.api = api;

    updateZoomBtnStatus(featureModel, ecModel, this, payload, api);
    updateBackBtnStatus(featureModel, ecModel);
};

proto.onclick = function (ecModel, api, type) {
    handlers[type].call(this);
};

proto.remove = function (ecModel, api) {
    this._brushController.unmount();
};

proto.dispose = function (ecModel, api) {
    this._brushController.dispose();
};

/**
 * @private
 */
var handlers = {

    zoom: function () {
        var nextActive = !this._isZoomActive;

        this.api.dispatchAction({
            type: 'takeGlobalCursor',
            key: 'dataZoomSelect',
            dataZoomSelectActive: nextActive
        });
    },

    back: function () {
        this._dispatchZoomAction(history.pop(this.ecModel));
    }
};

/**
 * @private
 */
proto._onBrush = function (areas, opt) {
    if (!opt.isEnd || !areas.length) {
        return;
    }
    var snapshot = {};
    var ecModel = this.ecModel;

    this._brushController.updateCovers([]); // remove cover

    var brushTargetManager = new BrushTargetManager(
        retrieveAxisSetting(this.model.option), ecModel, {include: ['grid']}
    );
    brushTargetManager.matchOutputRanges(areas, ecModel, function (area, coordRange, coordSys) {
        if (coordSys.type !== 'cartesian2d') {
            return;
        }

        var brushType = area.brushType;
        if (brushType === 'rect') {
            setBatch('x', coordSys, coordRange[0]);
            setBatch('y', coordSys, coordRange[1]);
        }
        else {
            setBatch(({lineX: 'x', lineY: 'y'})[brushType], coordSys, coordRange);
        }
    });

    history.push(ecModel, snapshot);

    this._dispatchZoomAction(snapshot);

    function setBatch(dimName, coordSys, minMax) {
        var axis = coordSys.getAxis(dimName);
        var axisModel = axis.model;
        var dataZoomModel = findDataZoom(dimName, axisModel, ecModel);

        // Restrict range.
        var minMaxSpan = dataZoomModel.findRepresentativeAxisProxy(axisModel).getMinMaxSpan();
        if (minMaxSpan.minValueSpan != null || minMaxSpan.maxValueSpan != null) {
            minMax = sliderMove(
                0, minMax.slice(), axis.scale.getExtent(), 0,
                minMaxSpan.minValueSpan, minMaxSpan.maxValueSpan
            );
        }

        dataZoomModel && (snapshot[dataZoomModel.id] = {
            dataZoomId: dataZoomModel.id,
            startValue: minMax[0],
            endValue: minMax[1]
        });
    }

    function findDataZoom(dimName, axisModel, ecModel) {
        var found;
        ecModel.eachComponent({mainType: 'dataZoom', subType: 'select'}, function (dzModel) {
            var has = dzModel.getAxisModel(dimName, axisModel.componentIndex);
            has && (found = dzModel);
        });
        return found;
    }
};

/**
 * @private
 */
proto._dispatchZoomAction = function (snapshot) {
    var batch = [];

    // Convert from hash map to array.
    each(snapshot, function (batchItem, dataZoomId) {
        batch.push(zrUtil.clone(batchItem));
    });

    batch.length && this.api.dispatchAction({
        type: 'dataZoom',
        from: this.uid,
        batch: batch
    });
};

function retrieveAxisSetting(option) {
    var setting = {};
    // Compatible with previous setting: null => all axis, false => no axis.
    zrUtil.each(['xAxisIndex', 'yAxisIndex'], function (name) {
        setting[name] = option[name];
        setting[name] == null && (setting[name] = 'all');
        (setting[name] === false || setting[name] === 'none') && (setting[name] = []);
    });
    return setting;
}

function updateBackBtnStatus(featureModel, ecModel) {
    featureModel.setIconStatus(
        'back',
        history.count(ecModel) > 1 ? 'emphasis' : 'normal'
    );
}

function updateZoomBtnStatus(featureModel, ecModel, view, payload, api) {
    var zoomActive = view._isZoomActive;

    if (payload && payload.type === 'takeGlobalCursor') {
        zoomActive = payload.key === 'dataZoomSelect'
            ? payload.dataZoomSelectActive : false;
    }

    view._isZoomActive = zoomActive;

    featureModel.setIconStatus('zoom', zoomActive ? 'emphasis' : 'normal');

    var brushTargetManager = new BrushTargetManager(
        retrieveAxisSetting(featureModel.option), ecModel, {include: ['grid']}
    );

    view._brushController
        .setPanels(brushTargetManager.makePanelOpts(api, function (targetInfo) {
            return (targetInfo.xAxisDeclared && !targetInfo.yAxisDeclared)
                ? 'lineX'
                : (!targetInfo.xAxisDeclared && targetInfo.yAxisDeclared)
                ? 'lineY'
                : 'rect';
        }))
        .enableBrush(
            zoomActive
            ? {
                brushType: 'auto',
                brushStyle: featureModel.getModel('brushStyle').getItemStyle()
            }
            : false
        );
}


featureManager.register('dataZoom', DataZoom);


// Create special dataZoom option for select
// FIXME consider the case of merge option, where axes options are not exists.
echarts.registerPreprocessor(function (option) {
    if (!option) {
        return;
    }

    var dataZoomOpts = option.dataZoom || (option.dataZoom = []);
    if (!zrUtil.isArray(dataZoomOpts)) {
        option.dataZoom = dataZoomOpts = [dataZoomOpts];
    }

    var toolboxOpt = option.toolbox;
    if (toolboxOpt) {
        // Assume there is only one toolbox
        if (zrUtil.isArray(toolboxOpt)) {
            toolboxOpt = toolboxOpt[0];
        }

        if (toolboxOpt && toolboxOpt.feature) {
            var dataZoomOpt = toolboxOpt.feature.dataZoom || {};
            // FIXME: If add dataZoom when setOption in merge mode,
            // no axis info to be added. See `test/dataZoom-extreme.html`
            addForAxis('xAxis', dataZoomOpt);
            addForAxis('yAxis', dataZoomOpt);
        }
    }

    function addForAxis(axisName, dataZoomOpt) {
        if (!dataZoomOpt) {
            return;
        }

        // Try not to modify model, because it is not merged yet.
        var axisIndicesName = axisName + 'Index';
        var givenAxisIndices = dataZoomOpt[axisIndicesName];
        if (givenAxisIndices != null
            && givenAxisIndices !== 'all'
            && !zrUtil.isArray(givenAxisIndices)
        ) {
            givenAxisIndices = (givenAxisIndices === false || givenAxisIndices === 'none') ? [] : [givenAxisIndices];
        }

        forEachComponent(axisName, function (axisOpt, axisIndex) {
            if (givenAxisIndices != null
                && givenAxisIndices !== 'all'
                && zrUtil.indexOf(givenAxisIndices, axisIndex) === -1
            ) {
                return;
            }
            var newOpt = {
                type: 'select',
                $fromToolbox: true,
                // Default to be filter
                filterMode: dataZoomOpt.filterMode || 'filter',
                // Id for merge mapping.
                id: DATA_ZOOM_ID_BASE + axisName + axisIndex
            };
            // FIXME
            // Only support one axis now.
            newOpt[axisIndicesName] = axisIndex;
            dataZoomOpts.push(newOpt);
        });
    }

    function forEachComponent(mainType, cb) {
        var opts = option[mainType];
        if (!zrUtil.isArray(opts)) {
            opts = opts ? [opts] : [];
        }
        each(opts, cb);
    }
});

export default DataZoom;