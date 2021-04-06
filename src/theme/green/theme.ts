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
    '#408829',
    '#68a54a',
    '#a9cba2',
    '#86b379',
    '#397b29',
    '#8abb6f',
    '#759c6a',
    '#bfd3b7'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#408829'
        }
    },

    visualMap: {
        color: ['408829', '#a9cba2']
    },

    toolbox: {
        color: ['#408829', '#408829', '#408829', '#408829']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#408829',
                type: 'dashed'
            },
            crossStyle: {
                color: '#408829'
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
        fillerColor: 'rgba(64,136,41,0.2)', // Fill the color
        handleColor: '#408829' // Handle color
    },

    grid: {
        borderWidth: 0
    },

    categoryAxis: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: '#408829'
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
                color: '#408829'
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
            color: '#408829'
        },
        controlStyle: {
            color: '#408829',
            borderColor: '#408829'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#68a54a',
            color0: '#a9cba2'
        },
        lineStyle: {
            width: 1,
            color: '#408829',
            color0: '#86b379'
        },
        areaStyle: {
            color: '#408829',
            color0: '#bfd3b7'
        }
    },

    graph: {
        itemStyle: {
            color: '#bfd3b7'
        },
        linkStyle: {
            color: '#408829'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#bfd3b7',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#408829'
        }
    },

    map: {
        itemStyle: {
            color: '#ddd'
        },
        areaStyle: {
            color: '#408829'
        },
        label: {
            color: '#000'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#86b379'],
                    [0.8, '#68a54a'],
                    [1, '#408829']
                ],
                width: 8
            }
        }
    }
};
