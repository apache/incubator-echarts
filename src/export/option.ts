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

import type {GridOption as GridComponentOption} from '../coord/cartesian/GridModel';
import type {PolarOption as PolarComponentOption} from '../coord/polar/PolarModel';
import type {RadarOption as RadarComponentOption} from '../coord/radar/RadarModel';
import type {GeoOption as GeoComponentOption} from '../coord/geo/GeoModel';
import type {
    RadiusAxisOption as RadiusAxisComponentOption,
    AngleAxisOption as AngleAxisComponentOption
} from '../coord/polar/AxisModel';
import type {
    XAXisOption as XAXisComponentOption,
    YAXisOption as YAXisComponentOption
} from '../coord/cartesian/AxisModel';
import type {SingleAxisOption as SingleAxisComponentOption} from '../coord/single/AxisModel';
import type {ParallelAxisOption as ParallelAxisComponentOption} from '../coord/parallel/AxisModel';
import type {ParallelCoordinateSystemOption as ParallelComponentOption} from '../coord/parallel/ParallelModel';
import type {CalendarOption as CalendarComponentOption} from '../coord/calendar/CalendarModel';
import type {ToolboxOption} from '../component/toolbox/ToolboxModel';
import type {TooltipOption as TooltipComponentOption} from '../component/tooltip/TooltipModel';
import type {AxisPointerOption as AxisPointerComponentOption} from '../component/axisPointer/AxisPointerModel';
import type {BrushOption as BrushComponentOption} from '../component/brush/BrushModel';
import type {TitleOption as TitleComponentOption} from '../component/title/install';
import type {TimelineOption as TimelineComponentOption} from '../component/timeline/TimelineModel';
import type {SliderTimelineOption as TimelineSliderComponentOption} from '../component/timeline/SliderTimelineModel';

import type {LegendOption as PlainLegendComponentOption} from '../component/legend/LegendModel';
import type {
    ScrollableLegendOption as ScrollableLegendComponentOption
} from '../component/legend/ScrollableLegendModel';

import type {SliderDataZoomOption as SliderDataZoomComponentOption} from '../component/dataZoom/SliderZoomModel';
import type {
    InsideDataZoomOption as InsideDataZoomComponentOption
} from '../component/dataZoom/InsideZoomModel';

import type {
    ContinousVisualMapOption as ContinousVisualMapComponentOption
} from '../component/visualMap/ContinuousModel';
import type {
    PiecewiseVisualMapOption as PiecewiseVisualMapComponentOption
} from '../component/visualMap/PiecewiseModel';

import type {MarkLineOption as MarkLineComponentOption} from '../component/marker/MarkLineModel';
import type {MarkPointOption as MarkPointComponentOption} from '../component/marker/MarkPointModel';
import type {MarkAreaOption as MarkAreaComponentOption} from '../component/marker/MarkAreaModel';

import type {LineSeriesOption as LineSeriesOptionInner} from '../chart/line/LineSeries';
import type {BarSeriesOption as BarSeriesOptionInner} from '../chart/bar/BarSeries';
import type {ScatterSeriesOption as ScatterSeriesOptionInner} from '../chart/scatter/ScatterSeries';
import type {PieSeriesOption as PieSeriesOptionInner} from '../chart/pie/PieSeries';
import type {RadarSeriesOption as RadarSeriesOptionInner} from '../chart/radar/RadarSeries';
import type {MapSeriesOption as MapSeriesOptionInner} from '../chart/map/MapSeries';
import type {TreeSeriesOption as TreeSeriesOptionInner} from '../chart/tree/TreeSeries';
import type {TreemapSeriesOption as TreemapSeriesOptionInner} from '../chart/treemap/TreemapSeries';
import type {GraphSeriesOption as GraphSeriesOptionInner} from '../chart/graph/GraphSeries';
import type {GaugeSeriesOption as GaugeSeriesOptionInner} from '../chart/gauge/GaugeSeries';
import type {FunnelSeriesOption as FunnelSeriesOptionInner} from '../chart/funnel/FunnelSeries';
import type {ParallelSeriesOption as ParallelSeriesOptionInner} from '../chart/parallel/ParallelSeries';
import type {SankeySeriesOption as SankeySeriesOptionInner} from '../chart/sankey/SankeySeries';
import type {BoxplotSeriesOption as BoxplotSeriesOptionInner} from '../chart/boxplot/BoxplotSeries';
import type {CandlestickSeriesOption as CandlestickSeriesOptionInner} from '../chart/candlestick/CandlestickSeries';
import type {
    EffectScatterSeriesOption as EffectScatterSeriesOptionInner
} from '../chart/effectScatter/EffectScatterSeries';
import type {LinesSeriesOption as LinesSeriesOptionInner} from '../chart/lines/LinesSeries';
import type {HeatmapSeriesOption as HeatmapSeriesOptionInner} from '../chart/heatmap/HeatmapSeries';
import type {PictorialBarSeriesOption as PictorialBarSeriesOptionInner} from '../chart/bar/PictorialBarSeries';
import type {ThemeRiverSeriesOption as ThemeRiverSeriesOptionInner} from '../chart/themeRiver/ThemeRiverSeries';
import type {SunburstSeriesOption as SunburstSeriesOptionInner} from '../chart/sunburst/SunburstSeries';
import type {CustomSeriesOption as CustomSeriesOptionInner} from '../chart/custom/install';

import type {GraphicComponentLooseOption as GraphicComponentOption} from '../component/graphic/install';
import type {DatasetOption as DatasetComponentOption} from '../component/dataset/install';

import type {ToolboxBrushFeatureOption} from '../component/toolbox/feature/Brush';
import type {ToolboxDataViewFeatureOption} from '../component/toolbox/feature/DataView';
import type {ToolboxDataZoomFeatureOption} from '../component/toolbox/feature/DataZoom';
import type {ToolboxMagicTypeFeatureOption} from '../component/toolbox/feature/MagicType';
import type {ToolboxRestoreFeatureOption} from '../component/toolbox/feature/Restore';
import type {ToolboxSaveAsImageFeatureOption} from '../component/toolbox/feature/SaveAsImage';
import type {ToolboxFeatureOption} from '../component/toolbox/featureManager';


import type {ECBasicOption, SeriesTooltipOption, AriaOption as AriaComponentOption} from '../util/types';

interface ToolboxComponentOption extends ToolboxOption {
    feature?: {
        brush?: ToolboxBrushFeatureOption
        dataView?: ToolboxDataViewFeatureOption
        dataZoom?: ToolboxDataZoomFeatureOption
        magicType?: ToolboxMagicTypeFeatureOption
        restore?: ToolboxRestoreFeatureOption
        saveAsImage?: ToolboxSaveAsImageFeatureOption
        // custom feature
        [key: string]: ToolboxFeatureOption | {
            [key: string]: any
        } | undefined
    }
}

export {SliderDataZoomComponentOption, InsideDataZoomComponentOption};
export type DataZoomComponentOption = SliderDataZoomComponentOption | InsideDataZoomComponentOption;
export {ContinousVisualMapComponentOption, PiecewiseVisualMapComponentOption};
export type VisualMapComponentOption = ContinousVisualMapComponentOption | PiecewiseVisualMapComponentOption;
export {PlainLegendComponentOption, ScrollableLegendComponentOption};
export type LegendComponentOption = PlainLegendComponentOption | ScrollableLegendComponentOption;
export {
    GridComponentOption,
    PolarComponentOption,
    RadarComponentOption,
    GeoComponentOption,
    XAXisComponentOption,
    YAXisComponentOption,
    SingleAxisComponentOption,
    RadiusAxisComponentOption,
    AngleAxisComponentOption,
    ParallelComponentOption,
    CalendarComponentOption,
    TooltipComponentOption,
    AxisPointerComponentOption,
    BrushComponentOption,
    TitleComponentOption,
    TimelineComponentOption,
    MarkLineComponentOption,
    MarkPointComponentOption,
    MarkAreaComponentOption,
    ToolboxComponentOption,
    GraphicComponentOption,
    AriaComponentOption,
    DatasetComponentOption
};


type SeriesInjectedOption = {
    // Inject markArea markLine
    markArea?: MarkAreaComponentOption
    markLine?: MarkLineComponentOption
    markPoint?: MarkPointComponentOption
    tooltip?: SeriesTooltipOption
};

export type LineSeriesOption = LineSeriesOptionInner & SeriesInjectedOption;
export type BarSeriesOption = BarSeriesOptionInner & SeriesInjectedOption;
export type ScatterSeriesOption = ScatterSeriesOptionInner & SeriesInjectedOption;
export type PieSeriesOption = PieSeriesOptionInner & SeriesInjectedOption;
export type RadarSeriesOption = RadarSeriesOptionInner & SeriesInjectedOption;
export type MapSeriesOption = MapSeriesOptionInner & SeriesInjectedOption;
export type TreeSeriesOption = TreeSeriesOptionInner & SeriesInjectedOption;
export type TreemapSeriesOption = TreemapSeriesOptionInner & SeriesInjectedOption;
export type GraphSeriesOption = GraphSeriesOptionInner & SeriesInjectedOption;
export type GaugeSeriesOption = GaugeSeriesOptionInner & SeriesInjectedOption;
export type FunnelSeriesOption = FunnelSeriesOptionInner & SeriesInjectedOption;
export type ParallelSeriesOption = ParallelSeriesOptionInner & SeriesInjectedOption;
export type SankeySeriesOption = SankeySeriesOptionInner & SeriesInjectedOption;
export type BoxplotSeriesOption = BoxplotSeriesOptionInner & SeriesInjectedOption;
export type CandlestickSeriesOption = CandlestickSeriesOptionInner & SeriesInjectedOption;
export type EffectScatterSeriesOption = EffectScatterSeriesOptionInner & SeriesInjectedOption;
export type LinesSeriesOption = LinesSeriesOptionInner & SeriesInjectedOption;
export type HeatmapSeriesOption = HeatmapSeriesOptionInner & SeriesInjectedOption;
export type PictorialBarSeriesOption = PictorialBarSeriesOptionInner & SeriesInjectedOption;
export type ThemeRiverSeriesOption = ThemeRiverSeriesOptionInner & SeriesInjectedOption;
export type SunburstSeriesOption = SunburstSeriesOptionInner & SeriesInjectedOption;
export type CustomSeriesOption = CustomSeriesOptionInner & SeriesInjectedOption;

export type SeriesOption = LineSeriesOption
    | BarSeriesOption
    | ScatterSeriesOption
    | PieSeriesOption
    | RadarSeriesOption
    | MapSeriesOption
    | TreeSeriesOption
    | TreemapSeriesOption
    | GraphSeriesOption
    | GaugeSeriesOption
    | FunnelSeriesOption
    | ParallelSeriesOption
    | SankeySeriesOption
    | BoxplotSeriesOption
    | CandlestickSeriesOption
    | EffectScatterSeriesOption
    | LinesSeriesOption
    | HeatmapSeriesOption
    | PictorialBarSeriesOption
    | ThemeRiverSeriesOption
    | SunburstSeriesOption
    | CustomSeriesOption;

export interface EChartsOption extends ECBasicOption {
    dataset?: DatasetComponentOption | DatasetComponentOption[];
    aria?: AriaComponentOption;
    title?: TitleComponentOption | TitleComponentOption[];
    grid?: GridComponentOption | GridComponentOption[];
    radar?: RadarComponentOption | RadarComponentOption[];
    polar?: PolarComponentOption | PolarComponentOption[];
    geo?: GeoComponentOption | GeoComponentOption[];
    angleAxis?: AngleAxisComponentOption | AngleAxisComponentOption[];
    radiusAxis?: RadiusAxisComponentOption | RadiusAxisComponentOption[];
    xAxis?: XAXisComponentOption | XAXisComponentOption[];
    yAxis?: YAXisComponentOption | YAXisComponentOption[];
    singleAxis?: SingleAxisComponentOption | SingleAxisComponentOption[];
    parallel?: ParallelComponentOption | ParallelComponentOption[];
    parallelAxis?: ParallelAxisComponentOption | ParallelAxisComponentOption[];
    calendar?: CalendarComponentOption | CalendarComponentOption[];
    toolbox?: ToolboxComponentOption | ToolboxComponentOption[];
    tooltip?: TooltipComponentOption | TooltipComponentOption[];
    axisPointer?: AxisPointerComponentOption | AxisPointerComponentOption[];
    brush?: BrushComponentOption | BrushComponentOption[];
    timeline?: TimelineComponentOption | TimelineSliderComponentOption;
    legend?: LegendComponentOption | (LegendComponentOption)[];
    dataZoom?: DataZoomComponentOption | (DataZoomComponentOption)[];
    visualMap?: VisualMapComponentOption | (VisualMapComponentOption)[];
    graphic?: GraphicComponentOption | GraphicComponentOption[];

    // TODO Generally we support specify a single object on series.
    // But in practice we found the error hint in monaco editor is not clear if we also support
    // single object in type.
    series?: SeriesOption | SeriesOption[];

    options?: EChartsOption[];
    baseOption?: EChartsOption;
}
