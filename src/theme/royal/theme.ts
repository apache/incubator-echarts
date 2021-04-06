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

const colorPalette = [
    '#3f7ea6',
    '#993366',
    '#408000',
    '#8c6f56',
    '#a65149',
    '#731f17',
    '#adc2eb',
    '#d9c3b0'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#3f7ea6'
        }
    },

    visualMap: {
        color: ['#3f7ea6', '#993366']
    },

    toolbox: {
        color: ['#3f7ea6', '#3f7ea6', '#3f7ea6', '#3f7ea6']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#3f7ea6',
                type: 'dashed'
            },
            crossStyle: {
                color: '#3f7ea6'
            },
            shadowStyle: {
                // Shadow indicator style settings
                color: 'rgba(200,200,200,0.3)'
            }
        }
    },

    // Area scaling controller
    dataZoom: {
        dataBackgroundColor: '#eee', // Data background color
        fillerColor: 'rgba(200,200,200,0.2)', // Fill the color
        handleColor: '#3f7ea6' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#3f7ea6'
        },
        controlStyle: {
            color: '#3f7ea6',
            borderColor: '#3f7ea6'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#d9c3b0',
            color0: '#8c6f56'
        },
        lineStyle: {
            width: 1,
            color: '#731f17',
            color0: '#a65149'
        },
        areaStyle: {
            color: '#3f7ea6',
            color0: '#993366'
        }
    },

    map: {
        itemStyle: {
            color: '#d9c3b0'
        },
        areaStyle: {
            color: '#ddd'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#993366'
        },
        linkStyle: {
            color: '#3f7ea6'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#d9c3b0'],
                    [0.8, '#3f7ea6'],
                    [1, '#731f17']
                ],
                width: 8
            }
        }
    }
};
