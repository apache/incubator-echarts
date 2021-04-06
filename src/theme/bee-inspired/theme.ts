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
    '#001727',
    '#805500',
    '#ffff00',
    '#ffd11a',
    '#f2d71f',
    '#f2be19',
    '#f3a81a',
    '#fff5cc'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#001727'
        }
    },

    visualMap: {
        color: ['#001727', '#805500']
    },

    toolbox: {
        color: ['#001727', '#001727', '#001727', '#001727']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#001727',
                type: 'dashed'
            },
            crossStyle: {
                color: '#001727'
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
        handleColor: '#001727' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#001727'
        },
        controlStyle: {
            color: '#001727',
            borderColor: '#001727'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#f3a81a',
            color0: '#ffff00'
        },
        lineStyle: {
            width: 1,
            color: '#ffff00',
            color0: '#f3a81a'
        },
        areaStyle: {
            color: '#805500',
            color0: '#ffff00'
        }
    },

    chord: {
        padding: 4,
        itemStyle: {
            color: '#f3a81a',
            borderWidth: 1,
            borderColor: 'rgba(128, 128, 128, 0.5)'
        },
        lineStyle: {
            color: 'rgba(128, 128, 128, 0.5)'
        },
        areaStyle: {
            color: '#805500'
        }
    },

    map: {
        itemStyle: {
            color: '#ffd11a'
        },
        areaStyle: {
            color: '#f2be19'
        },
        label: {
            color: '#ffd11a'
        }
    },

    graph: {
        itemStyle: {
            color: '#001727'
        },
        linkStyle: {
            color: '#001727'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#f2d71f'],
                    [0.8, '#001727'],
                    [1, '#ffff00']
                ],
                width: 8
            }
        }
    }
};
