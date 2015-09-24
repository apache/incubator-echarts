define("echarts/chart/eventRiver",["require","./base","../layout/eventRiver","zrender/shape/Polygon","../component/axis","../component/grid","../component/dataZoom","../config","../util/ecData","../util/date","zrender/tool/util","zrender/tool/color","../chart"],function(e){function t(e,t,i,a,o){n.call(this,e,t,i,a,o);var r=this;r._ondragend=function(){r.isDragend=!0},this.refresh(a)}var n=e("./base"),i=e("../layout/eventRiver"),a=e("zrender/shape/Polygon");e("../component/axis"),e("../component/grid"),e("../component/dataZoom");var o=e("../config");o.eventRiver={zlevel:0,z:2,clickable:!0,legendHoverLink:!0,itemStyle:{normal:{borderColor:"rgba(0,0,0,0)",borderWidth:1,label:{show:!0,position:"inside",formatter:"{b}"}},emphasis:{borderColor:"rgba(0,0,0,0)",borderWidth:1,label:{show:!0}}}};var r=e("../util/ecData"),s=e("../util/date"),l=e("zrender/tool/util"),h=e("zrender/tool/color");return t.prototype={type:o.CHART_TYPE_EVENTRIVER,_buildShape:function(){var e=this.series;this.selectedMap={},this._dataPreprocessing();for(var t=this.component.legend,n=[],a=0;a<e.length;a++)if(e[a].type===this.type){e[a]=this.reformOption(e[a]),this.legendHoverLink=e[a].legendHoverLink||this.legendHoverLink;var o=e[a].name||"";if(this.selectedMap[o]=t?t.isSelected(o):!0,!this.selectedMap[o])continue;this.buildMark(a),n.push(this.series[a])}i(n,this._intervalX,this.component.grid.getArea()),this._drawEventRiver(),this.addShapeList()},_dataPreprocessing:function(){for(var e,t,n=this.series,i=0,a=n.length;a>i;i++)if(n[i].type===this.type){e=this.component.xAxis.getAxis(n[i].xAxisIndex||0);for(var o=0,r=n[i].data.length;r>o;o++){t=n[i].data[o].evolution;for(var l=0,h=t.length;h>l;l++)t[l].timeScale=e.getCoord(s.getNewDate(t[l].time)-0),t[l].valueScale=Math.pow(t[l].value,.8)}}this._intervalX=Math.round(this.component.grid.getWidth()/40)},_drawEventRiver:function(){for(var e=this.series,t=0;t<e.length;t++){var n=e[t].name||"";if(e[t].type===this.type&&this.selectedMap[n])for(var i=0;i<e[t].data.length;i++)this._drawEventBubble(e[t].data[i],t,i)}},_drawEventBubble:function(e,t,n){var i=this.series,o=i[t],s=o.name||"",l=o.data[n],m=[l,o],V=this.component.legend,U=V?V.getColor(s):this.zr.getColor(t),d=this.deepMerge(m,"itemStyle.normal")||{},p=this.deepMerge(m,"itemStyle.emphasis")||{},c=this.getItemStyleColor(d.color,t,n,l)||U,u=this.getItemStyleColor(p.color,t,n,l)||("string"==typeof c?h.lift(c,-.2):c),y=this._calculateControlPoints(e),g={zlevel:o.zlevel,z:o.z,clickable:this.deepQuery(m,"clickable"),style:{pointList:y,smooth:"spline",brushType:"both",lineJoin:"round",color:c,lineWidth:d.borderWidth,strokeColor:d.borderColor},highlightStyle:{color:u,lineWidth:p.borderWidth,strokeColor:p.borderColor},draggable:"vertical",ondragend:this._ondragend};g=new a(g),this.addLabel(g,o,l,e.name),r.pack(g,i[t],t,i[t].data[n],n,i[t].data[n].name),this.shapeList.push(g)},_calculateControlPoints:function(e){var t=this._intervalX,n=e.y,i=e.evolution,a=i.length;if(!(1>a)){for(var o=[],r=[],s=0;a>s;s++)o.push(i[s].timeScale),r.push(i[s].valueScale);var l=[];l.push([o[0],n]);var s=0;for(s=0;a-1>s;s++)l.push([(o[s]+o[s+1])/2,r[s]/-2+n]);for(l.push([(o[s]+(o[s]+t))/2,r[s]/-2+n]),l.push([o[s]+t,n]),l.push([(o[s]+(o[s]+t))/2,r[s]/2+n]),s=a-1;s>0;s--)l.push([(o[s]+o[s-1])/2,r[s-1]/2+n]);return l}},ondragend:function(e,t){this.isDragend&&e.target&&(t.dragOut=!0,t.dragIn=!0,t.needRefresh=!1,this.isDragend=!1)},refresh:function(e){e&&(this.option=e,this.series=e.series),this.backupShapeList(),this._buildShape()}},l.inherits(t,n),e("../chart").define("eventRiver",t),t}),define("echarts/layout/eventRiver",["require"],function(e){function t(e,t,i){function r(e,t){var n=e.importance,i=t.importance;return n>i?-1:i>n?1:0}for(var s=4,l=0;l<e.length;l++){for(var h=0;h<e[l].data.length;h++){null==e[l].data[h].weight&&(e[l].data[h].weight=1);for(var m=0,V=0;V<e[l].data[h].evolution.length;V++)m+=e[l].data[h].evolution[V].valueScale;e[l].data[h].importance=m*e[l].data[h].weight}e[l].data.sort(r)}for(var l=0;l<e.length;l++){null==e[l].weight&&(e[l].weight=1);for(var m=0,h=0;h<e[l].data.length;h++)m+=e[l].data[h].weight;e[l].importance=m*e[l].weight}e.sort(r);for(var U=Number.MAX_VALUE,d=0,l=0;l<e.length;l++)for(var h=0;h<e[l].data.length;h++)for(var V=0;V<e[l].data[h].evolution.length;V++){var p=e[l].data[h].evolution[V].timeScale;U=Math.min(U,p),d=Math.max(d,p)}U=~~U,d=~~d;for(var c=function(){var e=d-U+1+~~t;if(0>=e)return[0];for(var n=[];e--;)n.push(0);return n}(),u=c.slice(0),y=[],g=0,b=0,l=0;l<e.length;l++)for(var h=0;h<e[l].data.length;h++){var f=e[l].data[h];f.time=[],f.value=[];for(var k,_=0,V=0;V<e[l].data[h].evolution.length;V++)k=e[l].data[h].evolution[V],f.time.push(k.timeScale),f.value.push(k.valueScale),_=Math.max(_,k.valueScale);a(f,t,U),f.y=o(u,f,function(e,t){return e.ypx[t]}),f._offset=o(c,f,function(){return s}),g=Math.max(g,f.y+_),b=Math.max(b,f._offset),y.push(f)}n(y,i,g,b)}function n(e,t,n,i){for(var a=t.height,o=i/a>.5?.5:1,r=t.y,s=(t.height-i)/n,l=0,h=e.length;h>l;l++){var m=e[l];m.y=r+s*m.y+m._offset*o,delete m.time,delete m.value,delete m.xpx,delete m.ypx,delete m._offset;for(var V=m.evolution,U=0,d=V.length;d>U;U++)V[U].valueScale*=s}}function i(e,t,n,i){if(e===n)throw new Error("x0 is equal with x1!!!");if(t===i)return function(){return t};var a=(t-i)/(e-n),o=(i*e-t*n)/(e-n);return function(e){return a*e+o}}function a(e,t,n){var a=~~t,o=e.time.length;e.xpx=[],e.ypx=[];for(var r,s=0,l=0,h=0,m=0,V=0;o>s;s++){l=~~e.time[s],m=e.value[s]/2,s===o-1?(h=l+a,V=0):(h=~~e.time[s+1],V=e.value[s+1]/2),r=i(l,m,h,V);for(var U=l;h>U;U++)e.xpx.push(U-n),e.ypx.push(r(U))}e.xpx.push(h-n),e.ypx.push(V)}function o(e,t,n){for(var i,a=0,o=t.xpx.length,r=0;o>r;r++)i=n(t,r),a=Math.max(a,i+e[t.xpx[r]]);for(r=0;o>r;r++)i=n(t,r),e[t.xpx[r]]=a+i;return a}return t});