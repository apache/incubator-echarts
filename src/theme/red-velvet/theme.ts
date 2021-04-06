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
    '#8b1a2d',
    '#a7314b',
    '#e6004c',
    '#ff8066',
    '#8e5c4e',
    '#ff1a66',
    '#d6c582',
    '#f0d4af'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#8b1a2d'
        }
    },

    visualMap: {
        color: ['#8b1a2d', '#a7314b']
    },

    toolbox: {
        color: ['#8b1a2d', '#8b1a2d', '#8b1a2d', '#8b1a2d']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#8b1a2d',
                type: 'dashed'
            },
            crossStyle: {
                color: '#8b1a2d'
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
        handleColor: '#8b1a2d' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#8b1a2d'
        },
        controlStyle: {
            color: '#8b1a2d',
            borderColor: '#8b1a2d'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#a7314b',
            color0: '#d6c582'
        },
        lineStyle: {
            width: 1,
            color: '#8e5c4e',
            color0: '#f0d4af'
        },
        areaStyle: {
            color: '#8b1a2d',
            color0: '#ff8066'
        }
    },

    map: {
        itemStyle: {
            color: '#8b1a2d'
        },
        areaStyle: {
            color: '#ff8066'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#ff8066'
        },
        linkStyle: {
            color: '#8b1a2d'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#a7314b'],
                    [0.8, '#8b1a2d'],
                    [1, '#8e5c4e']
                ],
                width: 8
            }
        }
    }
};
