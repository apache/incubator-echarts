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

// Core API from echarts/src/echarts

export * from '../core/echarts';
export * from './api';
import { use } from '../extension';

// Import label layout by default.
// TODO remove
import {installLabelLayout} from '../label/installLabelLayout';
use(installLabelLayout);


// Export necessary types
export {ZRColor as Color, Payload} from '../util/types';
export {LinearGradientObject} from 'zrender/src/graphic/LinearGradient';
export {RadialGradientObject} from 'zrender/src/graphic/RadialGradient';
export {PatternObject, ImagePatternObject, SVGPatternObject} from 'zrender/src/graphic/Pattern';
export {ElementEvent} from 'zrender/src/Element';

// ComposeOption
import type { ComponentOption, ECBasicOption as EChartsCoreOption } from '../util/types';

import type { AxisPointerOption } from '../component/axisPointer/AxisPointerModel';
import type { XAXisOption, YAXisOption } from '../coord/cartesian/AxisModel';
import type { AngleAxisOption, RadiusAxisOption } from '../coord/polar/AxisModel';
import type { ParallelAxisOption } from '../coord/parallel/AxisModel';


export {EChartsType as ECharts} from '../core/echarts';

export {EChartsCoreOption};

// type SeriesSubComponentsTypes = 'markPoint' | 'markLine' | 'markArea' | 'tooltip';
// type InjectSeriesSubComponents<OptionUnion extends ComponentOption, Injected> =
//     'series' extends GetMainType<OptionUnion>
//         ? (OptionUnion & Injected) : OptionUnion;
// // NOTE: Can't use GetMainType<OptionUnion> extends xxx ? GetMainType<OptionUnion> : xxx
// // Or the infer can't work.
// type GetSeriesInjectedSubOption<MainType extends string, OptionUnion extends ComponentOption> = {
//     [key in Extract<MainType, SeriesSubComponentsTypes>]?: ExtractComponentOption<OptionUnion, key>
// };


// TODO: Handwritten dependencies
type Dependencies = {
    grid: XAXisOption | YAXisOption | AxisPointerOption;
    polar: AngleAxisOption | RadiusAxisOption
    parallel: ParallelAxisOption
};

type DependenciesKeys = keyof Dependencies & string;

type Arrayable<T> = T | T[];

type GetMainType<OptionUnion extends ComponentOption> = Exclude<OptionUnion['mainType'], undefined>;

// NOTE: Needs to extract the specify ComponentOption for each component type.
type ExtractComponentOption<OptionUnion, ExtractMainType> = OptionUnion extends {
    mainType?: ExtractMainType
} ? OptionUnion : never;

type GetDependency<DependencyOption extends ComponentOption> = {
    [key in GetMainType<DependencyOption>]?: Arrayable<
        ExtractComponentOption<DependencyOption, key>
    >
};

type GetDependencies<MainType extends string> = GetDependency<Dependencies[Extract<MainType, DependenciesKeys>]>;

type ComposeUnitOption<OptionUnion extends ComponentOption> =
    // Will be never if some component forget to specify mainType.
    CheckMainType<GetMainType<OptionUnion>> &
    Omit<EChartsCoreOption, 'baseOption' | 'options'> & {
        [key in GetMainType<OptionUnion>]?: Arrayable<
            ExtractComponentOption<OptionUnion, key>
            // TODO: It will make error log too complex.
            // So this more strict type checking will not be used currently to make sure the error msg is friendly.
            //
            // Inject markPoint, markLine, markArea, tooltip in series.
            // ExtractComponentOption<
            //     InjectSeriesSubComponents<
            //         OptionUnion, GetSeriesInjectedSubOption<GetMainType<OptionUnion>, OptionUnion>
            //     >,
            //     key
            // >
        >
    } & GetDependencies<GetMainType<OptionUnion>>;

type CheckMainType<OptionUnionMainType extends string> =
    // If some component forget to specify mainType. we should do a fast check.
    string extends OptionUnionMainType ? never : {};


// TODO Provide a strict option.
export type ComposeOption<OptionUnion extends ComponentOption> =
    ComposeUnitOption<OptionUnion> & {
        baseOption?: ComposeUnitOption<OptionUnion>
        options?: ComposeUnitOption<OptionUnion>[]
    };