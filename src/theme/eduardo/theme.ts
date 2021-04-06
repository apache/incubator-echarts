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
    '#59535e',
    '#e7dcef',
    '#f1baf3',
    '#5d4970',
    '#372049',
    '#c0b2cd',
    '#ffccff',
    '#f2f0f5'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#59535e'
        }
    },

    visualMap: {
        color: ['#59535e', '#e7dcef']
    },

    toolbox: {
        color: ['#59535e', '#59535e', '#59535e', '#59535e']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#59535e',
                type: 'dashed'
            },
            crossStyle: {
                color: '#59535e'
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
        handleColor: '#59535e' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#59535e'
        },
        controlStyle: {
            color: '#59535e',
            borderColor: '#59535e'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#e7dcef',
            color0: '#f1baf3'
        },
        lineStyle: {
            width: 1,
            color: '#372049',
            color0: '#5d4970'
        },
        areaStyle: {
            color: '#59535e',
            color0: '#e7dcef'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#59535e',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#e7dcef'
        }
    },

    map: {
        itemStyle: {
            color: '#ddd'
        },
        areaStyle: {
            color: '#f1baf3'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#59535e'
        },
        linkStyle: {
            color: '#59535e'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#e7dcef'],
                    [0.8, '#59535e'],
                    [1, '#372049']
                ],
                width: 8
            }
        }
    }
};
