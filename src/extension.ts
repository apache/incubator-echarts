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
    registerPreprocessor,
    registerProcessor,
    registerPostInit,
    registerPostUpdate,
    registerAction,
    registerCoordinateSystem,
    registerLayout,
    registerVisual,
    registerTransform,
    registerLoading,
    registerMap,
    registerTheme,
    PRIORITY
} from './core/echarts';
import ComponentView from './view/Component';
import ChartView from './view/Chart';
import ComponentModel from './model/Component';
import SeriesModel from './model/Series';
import { isFunction, indexOf, isArray, each } from 'zrender/src/core/util';
import { Constructor } from './util/clazz';
import { SubTypeDefaulter } from './util/component';
import { registerPainter } from 'zrender/src/zrender';

const extensions: (EChartsExtensionInstaller | EChartsExtension)[] = [];

const extensionRegisters = {
    registerPreprocessor,
    registerProcessor,
    registerPostInit,
    registerPostUpdate,
    registerAction,
    registerCoordinateSystem,
    registerLayout,
    registerVisual,
    registerTransform,
    registerLoading,
    registerMap,
    registerTheme,
    PRIORITY,

    ComponentModel,
    ComponentView,
    SeriesModel,
    ChartView,
    // TODO Use ComponentModel and SeriesModel instead of Constructor
    registerComponentModel(ComponentModelClass: Constructor) {
        ComponentModel.registerClass(ComponentModelClass);
    },
    registerComponentView(ComponentViewClass: typeof ComponentView) {
        ComponentView.registerClass(ComponentViewClass);
    },
    registerSeriesModel(SeriesModelClass: Constructor) {
        SeriesModel.registerClass(SeriesModelClass);
    },
    registerChartView(ChartViewClass: typeof ChartView) {
        ChartView.registerClass(ChartViewClass);
    },
    registerSubTypeDefaulter(componentType: string, defaulter: SubTypeDefaulter) {
        ComponentModel.registerSubTypeDefaulter(componentType, defaulter);
    },
    registerPainter(painterType: string, PainterCtor: Parameters<typeof registerPainter>[1]) {
        registerPainter(painterType, PainterCtor);
    }
};

export type EChartsExtensionInstallRegisters = typeof extensionRegisters;

export type EChartsExtensionInstaller = (ec: EChartsExtensionInstallRegisters) => void;
export interface EChartsExtension {
    install: EChartsExtensionInstaller
}

export function use(
    ext: EChartsExtensionInstaller | EChartsExtension | (EChartsExtensionInstaller | EChartsExtension)[]
) {
    if (isArray(ext)) {
        // use([ChartLine, ChartBar]);
        each(ext, (singleExt) => {
            use(singleExt);
        });
        return;
    }

    if (indexOf(extensions, ext) >= 0) {
        return;
    }
    extensions.push(ext);

    if (isFunction(ext)) {
        ext = {
            install: ext
        };
    }
    ext.install(extensionRegisters);
}

// A simpler use type for exporting to reduce exported inner modules.
export type EChartsExtensionInstallerSimple = (registers: any) => void;
type SimpleEChartsExtensionType = EChartsExtensionInstallerSimple | { install: EChartsExtensionInstallerSimple };
export declare function useSimple(ext: SimpleEChartsExtensionType | (SimpleEChartsExtensionType)[]): void;
