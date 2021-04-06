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
    '#f2385a',
    '#f5a503',
    '#4ad9d9',
    '#f7879c',
    '#c1d7a8',
    '#4dffd2',
    '#fccfd7',
    '#d5f6f6'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#f2385a'
        }
    },

    visualMap: {
        color: ['#f2385a', '#f5a503']
    },

    toolbox: {
        color: ['#f2385a', '#f2385a', '#f2385a', '#f2385a']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#f2385a',
                type: 'dashed'
            },
            crossStyle: {
                color: '#f2385a'
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
        handleColor: '#f2385a' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#f2385a'
        },
        controlStyle: {
            color: '#f2385a',
            borderColor: '#f2385a'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#f2385a',
            color0: '#f5a503'
        },
        lineStyle: {
            width: 1,
            color: '#f2385a',
            color0: '#f5a503'
        },
        areaStyle: {
            color: '#c1d7a8',
            color0: '#4ad9d9'
        }
    },

    map: {
        itemStyle: {
            color: '#f2385a'
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
            color: '#f2385a'
        },
        linkStyle: {
            color: '#f2385a'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#f5a503'],
                    [0.8, '#f2385a'],
                    [1, '#c1d7a8']
                ],
                width: 8
            }
        }
    }
};
