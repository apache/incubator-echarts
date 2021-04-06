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
    '#d8361b',
    '#f16b4c',
    '#f7b4a9',
    '#d26666',
    '#99311c',
    '#c42703',
    '#d07e75'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#d8361b'
        }
    },

    visualMap: {
        color: ['#d8361b', '#ffd2d2']
    },

    dataRange: {
        color: ['#bd0707', '#ffd2d2']
    },

    toolbox: {
        color: ['#d8361b', '#d8361b', '#d8361b', '#d8361b']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#d8361b',
                type: 'dashed'
            },
            crossStyle: {
                color: '#d8361b'
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
        fillerColor: 'rgba(216,54,27,0.2)', // Fill the color
        handleColor: '#d8361b' // Handle color
    },

    grid: {
        borderWidth: 0
    },

    categoryAxis: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: '#d8361b'
            }
        },
        splitLine: {
            // Separation line
            lineStyle: {
                // Property 'lineStyle' (see lineStyle) controls line styles
                color: ['#eee']
            }
        }
    },

    valueAxis: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: '#d8361b'
            }
        },
        splitArea: {
            show: true,
            areaStyle: {
                color: ['rgba(250,250,250,0.1)', 'rgba(200,200,200,0.1)']
            }
        },
        splitLine: {
            // Separation line
            lineStyle: {
                // Property 'lineStyle' (see lineStyle) controls line styles
                color: ['#eee']
            }
        }
    },

    timeline: {
        lineStyle: {
            color: '#d8361b'
        },
        controlStyle: {
            color: '#d8361b',
            borderColor: '#d8361b'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#f16b4c',
            color0: '#f7b4a9'
        },
        lineStyle: {
            width: 1,
            color: '#d8361b',
            color0: '#d26666'
        },
        areaStyle: {
            color: '#d8361b',
            color0: '#d07e75'
        }
    },

    graph: {
        itemStyle: {
            color: '#d07e75'
        },
        linkStyle: {
            color: '#d8361b'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#d07e75',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#d8361b'
        }
    },

    map: {
        itemStyle: {
            color: '#d8361b'
        },
        areaStyle: {
            color: '#d07e75'
        },
        label: {
            color: '#c12e34'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#f16b4c'],
                    [0.8, '#d8361b'],
                    [1, '#99311c']
                ],
                width: 8
            }
        }
    }
};
