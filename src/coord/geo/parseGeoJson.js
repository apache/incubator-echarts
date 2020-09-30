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

/**
 * Parse and decode geo json
 * @module echarts/coord/geo/parseGeoJson
 */

import * as zrUtil from 'zrender/src/core/util';
import Region from './Region';

function decode(json) {
    if (!json.UTF8Encoding) {
        return json;
    }
    var encodeScale = json.UTF8Scale;
    if (encodeScale == null) {
        encodeScale = 1024;
    }

    var features = json.features;

    for (var f = 0; f < features.length; f++) {
        var feature = features[f];
        var geometry = feature.geometry;
        var coordinates = geometry.coordinates;
        var encodeOffsets = geometry.encodeOffsets;

        for (var c = 0; c < coordinates.length; c++) {
            var coordinate = coordinates[c];

            if (geometry.type === 'Polygon') {
                coordinates[c] = decodePolygon(
                    coordinate,
                    encodeOffsets[c],
                    encodeScale
                );
            }
            else if (geometry.type === 'MultiPolygon') {
                for (var c2 = 0; c2 < coordinate.length; c2++) {
                    var polygon = coordinate[c2];
                    coordinate[c2] = decodePolygon(
                        polygon,
                        encodeOffsets[c][c2],
                        encodeScale
                    );
                }
            }
        }
    }
    // Has been decoded
    json.UTF8Encoding = false;
    return json;
}

function decodePolygon(coordinate, encodeOffsets, encodeScale) {
    var result = [];
    var prevX = encodeOffsets[0];
    var prevY = encodeOffsets[1];

    for (var i = 0; i < coordinate.length; i += 2) {
        var x = coordinate.charCodeAt(i) - 64;
        var y = coordinate.charCodeAt(i + 1) - 64;
        // ZigZag decoding
        x = (x >> 1) ^ (-(x & 1));
        y = (y >> 1) ^ (-(y & 1));
        // Delta deocding
        x += prevX;
        y += prevY;

        prevX = x;
        prevY = y;
        // Dequantize
        result.push([x / encodeScale, y / encodeScale]);
    }

    return result;
}

/**
 * @alias module:echarts/coord/geo/parseGeoJson
 * @param {Object} geoJson
 * @param {string} nameProperty
 * @return {module:zrender/container/Group}
 */
export default function (geoJson, nameProperty) {

    decode(geoJson);

    return zrUtil.map(zrUtil.filter(geoJson.features, function (featureObj) {
        // Output of mapshaper may have geometry null
        return featureObj.geometry
            && featureObj.properties
            && (
                // avoid length error if missing coordinates
                (featureObj.geometry.coordinates && featureObj.geometry.coordinates.length > 0)
                // allow GeometryCollection
                || (featureObj.geometry.geometries && featureObj.geometry.geometries.length > 0)
            )
            ;
        
    }), function (featureObj) {
        var properties = featureObj.properties;
        var geo = featureObj.geometry;

        var coordinates = geo.coordinates;

        var geometries = [];
        if (geo.type === 'Polygon') {
            geometries.push({
                type: 'polygon',
                // According to the GeoJSON specification.
                // First must be exterior, and the rest are all interior(holes).
                exterior: coordinates[0],
                interiors: coordinates.slice(1)
            });
        }
        else if (geo.type === 'MultiPolygon') {
            zrUtil.each(coordinates, function (item) {
                if (item[0]) {
                    geometries.push({
                        type: 'polygon',
                        exterior: item[0],
                        interiors: item.slice(1)
                    });
                }
            });
        }
        else if (geo.type === 'GeometryCollection') {
            var geometries2 = geo.geometries;
            each$1(geometries2, function (geo) { // OR      zrUtil.each(geometries2, function (geo) {
                var coordinates = geo.coordinates;
                if (geo.type === 'Polygon') { // this is a full copy from above
                    geometries.push({
                        type: 'polygon',
                        exterior: coordinates[0],
                        interiors: coordinates.slice(1)
                    });
                } // end full copy
            });
        }

        var region = new Region(
            properties[nameProperty || 'name'],
            geometries,
            properties.cp
        );
        region.properties = properties;
        return region;
    });
}
