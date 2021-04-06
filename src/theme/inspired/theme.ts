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
    '#cc0000',
    '#002266',
    '#ff9900',
    '#006600',
    '#8a150f',
    '#076278',
    '#808080',
    '#f07b75'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#cc0000'
        }
    },

    visualMap: {
        color: ['#cc0000', '#002266']
    },

    toolbox: {
        color: ['#cc0000', '#cc0000', '#cc0000', '#cc0000']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#cc0000',
                type: 'dashed'
            },
            crossStyle: {
                color: '#cc0000'
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
        handleColor: '#cc0000' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#cc0000'
        },
        controlStyle: {
            color: '#cc0000',
            borderColor: '#cc0000'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#002266',
            color0: '#ff9900'
        },
        lineStyle: {
            width: 1,
            color: '#8a150f',
            color0: '#006600'
        },
        areaStyle: {
            color: '#cc0000',
            color0: '#ff9900'
        }
    },

    map: {
        itemStyle: {
            color: '#ff9900'
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
            color: '#ff9900'
        },
        linkStyle: {
            color: '#cc0000'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#002266'],
                    [0.8, '#cc0000'],
                    [1, '8a150f']
                ],
                width: 8
            }
        }
    }
};
