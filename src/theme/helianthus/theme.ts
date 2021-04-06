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
    '#44B7D3',
    '#E42B6D',
    '#F4E24E',
    '#FE9616',
    '#8AED35',
    '#ff69b4',
    '#ba55d3',
    '#cd5c5c',
    '#ffa500',
    '#40e0d0',
    '#E95569',
    '#ff6347',
    '#7b68ee',
    '#00fa9a',
    '#ffd700',
    '#6699FF',
    '#ff6666',
    '#3cb371',
    '#b8860b',
    '#30e0e0'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#8A826D'
        }
    },

    dataRange: {
        x: 'right',
        y: 'center',
        itemWidth: 5,
        itemHeight: 25,
        color: ['#E42B6D', '#F9AD96'],
        text: ['High', 'Low'], // Text, default is numeric text
        textStyle: {
            color: '#8A826D' // Range text color
        }
    },

    toolbox: {
        color: ['#E95569', '#E95569', '#E95569', '#E95569'],
        effectiveColor: '#ff4500',
        itemGap: 8
    },

    tooltip: {
        backgroundColor: 'rgba(138,130,109,0.7)', // Prompt background color, default is black with a transparency of 0.7
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#6B6455',
                type: 'dashed'
            },
            crossStyle: {
                color: '#A6A299'
            },
            shadowStyle: {
                // Shadow indicator style settings
                color: 'rgba(200,200,200,0.3)'
            }
        }
    },

    // Area scaling controller
    dataZoom: {
        dataBackgroundColor: 'rgba(130,197,209,0.6)', // Data background color
        fillerColor: 'rgba(233,84,105,0.1)', // Fill the color
        handleColor: 'rgba(107,99,84,0.8)' // Handle color
    },

    grid: {
        borderWidth: 0
    },

    categoryAxis: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: '#6B6455'
            }
        },
        splitLine: {
            // separate line
            show: false
        }
    },

    valueAxis: {
        axisLine: {
            // Coordinate axis
            show: true
        },
        splitArea: {
            show: false
        },
        splitLine: {
            // separate line
            lineStyle: {
                // Property 'lineStyle' controls line styles
                color: ['#FFF'],
                type: 'dashed'
            }
        }
    },

    polar: {
        axisLine: {
            // Coordinate axis
            lineStyle: {
                // // Property 'lineStyle' controls line styles
                color: '#ddd'
            }
        },
        splitArea: {
            show: true,
            areaStyle: {
                color: ['rgba(250,250,250,0.2)', 'rgba(200,200,200,0.2)']
            }
        },
        splitLine: {
            lineStyle: {
                color: '#ddd'
            }
        }
    },

    timeline: {
        lineStyle: {
            color: '#6B6455'
        },
        controlStyle: {
            color: '#6B6455',
            borderColor: '#6B6455'
        }
    },

    line: {
        smooth: true,
        symbol: 'emptyCircle', // Inflection point graphic type
        symbolSize: 3 // Inflection point graphic size
    },

    candlestick: {
        itemStyle: {
            color: '#e42B6d',
            color0: '#44B7d3'
        },
        lineStyle: {
            width: 1,
            color: '#e42B6d',
            color0: '#44B7d3'
        },
        areaStyle: {
            color: '#fe994e',
            color0: '#e42B6d'
        }
    },

    map: {
        itemStyle: {
            color: '#6b6455'
        },
        areaStyle: {
            color: '#ddd'
        },
        label: {
            color: '#e42B6d'
        }
    },

    graph: {
        itemStyle: {
            color: '#e42B6d'
        },
        linkStyle: {
            color: '#6b6455'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#e42B6d',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#6b6455'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#44B7D3'],
                    [0.8, '#6B6455'],
                    [1, '#E42B6D']
                ],
                width: 8
            }
        }
    }
};
