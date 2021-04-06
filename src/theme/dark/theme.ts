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

// registerd by default

const contrastColor = '#B9B8CE';
const backgroundColor = '#100C2A';
const axisCommon = function () {
    return {
        axisLine: {
            lineStyle: {
                color: contrastColor
            }
        },
        splitLine: {
            lineStyle: {
                color: '#484753'
            }
        },
        splitArea: {
            areaStyle: {
                color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']
            }
        },
        minorSplitLine: {
            lineStyle: {
                color: '#20203B'
            }
        }
    };
};

const colorPalette = [
    '#4992ff',
    '#7cffb2',
    '#fddd60',
    '#ff6e76',
    '#58d9f9',
    '#05c091',
    '#ff8a45',
    '#8d48e3',
    '#dd79ff'
];
const theme = {
    darkMode: true,

    color: colorPalette,
    backgroundColor: backgroundColor,
    axisPointer: {
        lineStyle: {
            color: '#817f91'
        },
        crossStyle: {
            color: '#817f91'
        },
        label: {
            // TODO Contrast of label backgorundColor
            color: '#fff'
        }
    },
    legend: {
        textStyle: {
            color: contrastColor
        }
    },
    textStyle: {
        color: contrastColor
    },
    title: {
        textStyle: {
            color: '#EEF1FA'
        },
        subtextStyle: {
            color: '#B9B8CE'
        }
    },
    toolbox: {
        iconStyle: {
            borderColor: contrastColor
        }
    },
    dataZoom: {
        borderColor: '#71708A',
        textStyle: {
            color: contrastColor
        },
        brushStyle: {
            color: 'rgba(135,163,206,0.3)'
        },
        handleStyle: {
            color: '#353450',
            borderColor: '#C5CBE3'
        },
        moveHandleStyle: {
            color: '#B0B6C3',
            opacity: 0.3
        },
        fillerColor: 'rgba(135,163,206,0.2)',
        emphasis: {
            handleStyle: {
                borderColor: '#91B7F2',
                color: '#4D587D'
            },
            moveHandleStyle: {
                color: '#636D9A',
                opacity: 0.7
            }
        },
        dataBackground: {
            lineStyle: {
                color: '#71708A',
                width: 1
            },
            areaStyle: {
                color: '#71708A'
            }
        },
        selectedDataBackground: {
            lineStyle: {
                color: '#87A3CE'
            },
            areaStyle: {
                color: '#87A3CE'
            }
        }
    },
    visualMap: {
        textStyle: {
            color: contrastColor
        }
    },
    timeline: {
        lineStyle: {
            color: contrastColor
        },
        label: {
            color: contrastColor
        },
        controlStyle: {
            color: contrastColor,
            borderColor: contrastColor
        }
    },
    calendar: {
        itemStyle: {
            color: backgroundColor
        },
        dayLabel: {
            color: contrastColor
        },
        monthLabel: {
            color: contrastColor
        },
        yearLabel: {
            color: contrastColor
        }
    },
    timeAxis: axisCommon(),
    logAxis: axisCommon(),
    valueAxis: axisCommon(),
    categoryAxis: axisCommon(),

    line: {
        symbol: 'circle'
    },
    graph: {
        color: colorPalette
    },
    gauge: {
        title: {
            color: contrastColor
        },
        axisLine: {
            lineStyle: {
                color: [[1, 'rgba(207,212,219,0.2)']]
            }
        },
        axisLabel: {
            color: contrastColor
        },
        detail: {
            color: '#EEF1FA'
        }
    },
    candlestick: {
        itemStyle: {
            color: '#f64e56',
            color0: '#54ea92',
            borderColor: '#f64e56',
            borderColor0: '#54ea92'
            // borderColor: '#ca2824',
            // borderColor0: '#09a443'
        }
    }
};
(theme.categoryAxis.splitLine as any).show = false;

export default theme;
