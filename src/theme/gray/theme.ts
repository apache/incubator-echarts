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
    '#757575',
    '#c7c7c7',
    '#dadada',
    '#8b8b8b',
    '#b5b5b5',
    '#e9e9e9'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#757575'
        }
    },

    dataRange: {
        color: ['#636363', '#dcdcdc']
    },

    toolbox: {
        color: ['#757575', '#757575', '#757575', '#757575']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#757575',
                type: 'dashed'
            },
            crossStyle: {
                color: '#757575'
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
        fillerColor: 'rgba(117,117,117,0.2)', // Fill the color
        handleColor: '#757575' // Handle color
    },

    grid: {
        borderWidth: 0
    },

    categoryAxis: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: '#757575'
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
                color: '#757575'
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
            color: '#757575'
        },
        controlStyle: {
            color: '#757575',
            borderColor: '#757575'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#8b8b8b',
            color0: '#dadada'
        },
        lineStyle: {
            width: 1,
            color: '#757575',
            color0: '#c7c7c7'
        },
        areaStyle: {
            color: '#757575',
            color0: '#e9e9e9'
        }
    },

    map: {
        itemStyle: {
            color: '#c7c7c7'
        },
        areaStyle: {
            color: 'ddd'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#e9e9e9'
        },
        linkStyle: {
            color: '#757575'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#e9e9e9',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#757575'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#b5b5b5'],
                    [0.8, '#757575'],
                    [1, '#5c5c5c']
                ],
                width: 8
            }
        }
    }
};
