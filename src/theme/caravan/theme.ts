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
    '#fad089',
    '#ff9c5b',
    '#f5634a',
    '#ed303c',
    '#3b8183',
    '#f7826e',
    '#faac9e',
    '#fcd5cf'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#fad089'
        }
    },

    visualMap: {
        color: ['#fad089', '#a2d4e6']
    },

    toolbox: {
        color: ['#fad089', '#fad089', '#fad089', '#fad089']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#fad089',
                type: 'dashed'
            },
            crossStyle: {
                color: '#fad089'
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
        handleColor: '#fad089' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#fad089'
        },
        controlStyle: {
            color: '#fad089',
            borderColor: '#fad089'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#ff9c5b',
            color0: '#f5634a'
        },
        lineStyle: {
            width: 1,
            color: '#3b8183',
            color0: '#ed303c'
        },
        areaStyle: {
            color: '#fad089',
            color0: '#ed303c'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#fad089',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#ed303c'
        }
    },

    map: {
        itemStyle: {
            color: '#ddd'
        },
        areaStyle: {
            color: '#f5634a'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#f5634a'
        },
        linkStyle: {
            color: '#fad089'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#ff9c5b'],
                    [0.8, '#fad089'],
                    [1, '#3b8183']
                ],
                width: 8
            }
        }
    }
};
