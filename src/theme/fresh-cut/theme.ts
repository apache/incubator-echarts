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
    '#00a8c6',
    '#40c0cb',
    '#f0dec2',
    '#aee239',
    '#8fbe00',
    '#33e0ff',
    '#b3f4ff',
    '#e6ff99'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#00a8c6'
        }
    },

    visualMap: {
        color: ['#00a8c6', '#a2d4e6']
    },

    toolbox: {
        color: ['#00a8c6', '#00a8c6', '#00a8c6', '#00a8c6']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#00a8c6',
                type: 'dashed'
            },
            crossStyle: {
                color: '#00a8c6'
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
        fillerColor: 'rgba(144,197,237,0.2)', // Fill the color
        handleColor: '#00a8c6' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#00a8c6'
        },
        controlStyle: {
            color: '#00a8c6',
            borderColor: '#00a8c6'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#40c0cb',
            color0: '#f0dec2'
        },
        lineStyle: {
            width: 1,
            color: '#8fbe00',
            color0: '#aee239'
        },
        areaStyle: {
            color: '#00a8c6',
            color0: '#aee239'
        }
    },

    map: {
        itemStyle: {
            color: '#ddd'
        },
        areaStyle: {
            color: '#f0dec2'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#f0dec2'
        },
        linkStyle: {
            color: '#00a8c6'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#40c0cb'],
                    [0.8, '#00a8c6'],
                    [1, '#8fbe00']
                ],
                width: 8
            }
        }
    }
};
