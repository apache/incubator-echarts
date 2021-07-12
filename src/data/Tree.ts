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
 * Tree data structure
 */

import * as zrUtil from 'zrender/src/core/util';
import Model from '../model/Model';
import linkList from './helper/linkList';
import List from './List';
import createDimensions from './helper/createDimensions';
import {
    DimensionLoose, ParsedValue, OptionDataValue,
    OptionDataItemObject
} from '../util/types';
import { Dictionary } from 'zrender/src/core/types';
import { convertOptionIdName } from '../util/model';

type TreeTraverseOrder = 'preorder' | 'postorder';
type TreeTraverseCallback<Ctx> = (this: Ctx, node: TreeNode) => boolean | void;
type TreeTraverseOption = {
    order?: TreeTraverseOrder
    attr?: 'children' | 'viewChildren'
};

interface TreeNodeOption extends Pick<OptionDataItemObject<OptionDataValue>, 'name' | 'value'> {
    children?: TreeNodeOption[];
}

export class TreeNode {
    name: string;

    depth: number = 0;

    height: number = 0;

    parentNode: TreeNode;
    /**
     * Reference to list item.
     * Do not persistent dataIndex outside,
     * besause it may be changed by list.
     * If dataIndex -1,
     * this node is logical deleted (filtered) in list.
     */
    dataIndex: number = -1;

    children: TreeNode[] = [];

    viewChildren: TreeNode[] = [];

    isExpand: boolean = false;

    readonly hostTree: Tree<Model>;

    constructor(name: string, hostTree: Tree<Model>) {
        this.name = name || '';

        this.hostTree = hostTree;
    }
    /**
     * The node is removed.
     */
    isRemoved(): boolean {
        return this.dataIndex < 0;
    }

    /**
     * Travel this subtree (include this node).
     * Usage:
     *    node.eachNode(function () { ... }); // preorder
     *    node.eachNode('preorder', function () { ... }); // preorder
     *    node.eachNode('postorder', function () { ... }); // postorder
     *    node.eachNode(
     *        {order: 'postorder', attr: 'viewChildren'},
     *        function () { ... }
     *    ); // postorder
     *
     * @param options If string, means order.
     * @param options.order 'preorder' or 'postorder'
     * @param options.attr 'children' or 'viewChildren'
     * @param cb If in preorder and return false,
     *                      its subtree will not be visited.
     */
    eachNode<Ctx>(options: TreeTraverseOrder, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(options: TreeTraverseOption, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(
        options: TreeTraverseOrder | TreeTraverseOption | TreeTraverseCallback<Ctx>,
        cb?: TreeTraverseCallback<Ctx> | Ctx,
        context?: Ctx
    ) {
        if (typeof options === 'function') {
            context = cb as Ctx;
            cb = options;
            options = null;
        }

        options = options || {};
        if (zrUtil.isString(options)) {
            options = {order: options};
        }

        const order = (options as TreeTraverseOption).order || 'preorder';
        const children = this[(options as TreeTraverseOption).attr || 'children'];

        let suppressVisitSub;
        order === 'preorder' && (suppressVisitSub = (cb as TreeTraverseCallback<Ctx>).call(context as Ctx, this));

        for (let i = 0; !suppressVisitSub && i < children.length; i++) {
            children[i].eachNode(
                options as TreeTraverseOption,
                cb as TreeTraverseCallback<Ctx>,
                context
            );
        }

        order === 'postorder' && (cb as TreeTraverseCallback<Ctx>).call(context, this);
    }

    /**
     * Update depth and height of this subtree.
     */
    updateDepthAndHeight(depth: number) {
        let height = 0;
        this.depth = depth;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.updateDepthAndHeight(depth + 1);
            if (child.height > height) {
                height = child.height;
            }
        }
        this.height = height + 1;
    }

    getNodeById(id: string): TreeNode {
        if (this.getId() === id) {
            return this;
        }
        for (let i = 0, children = this.children, len = children.length; i < len; i++) {
            const res = children[i].getNodeById(id);
            if (res) {
                return res;
            }
        }
    }

    contains(node: TreeNode): boolean {
        if (node === this) {
            return true;
        }
        for (let i = 0, children = this.children, len = children.length; i < len; i++) {
            const res = children[i].contains(node);
            if (res) {
                return res;
            }
        }
    }

    /**
     * @param includeSelf Default false.
     * @return order: [root, child, grandchild, ...]
     */
    getAncestors(includeSelf?: boolean): TreeNode[] {
        const ancestors = [];
        let node = includeSelf ? this : this.parentNode;
        while (node) {
            ancestors.push(node);
            node = node.parentNode;
        }
        ancestors.reverse();
        return ancestors;
    }

    getAncestorsIndices(): number[] {
        const indices: number[] = [];
        let currNode = this as TreeNode;
        while (currNode) {
            indices.push(currNode.dataIndex);
            currNode = currNode.parentNode;
        }
        indices.reverse();
        return indices;
    }

    getDescendantIndices(): number[] {
        const indices: number[] = [];
        this.eachNode(childNode => {
            indices.push(childNode.dataIndex);
        });
        return indices;
    }

    getValue(dimension?: DimensionLoose): ParsedValue {
        const data = this.hostTree.data;
        return data.get(data.getDimension(dimension || 'value'), this.dataIndex);
    }

    setLayout(layout: any, merge?: boolean) {
        this.dataIndex >= 0
            && this.hostTree.data.setItemLayout(this.dataIndex, layout, merge);
    }

    /**
     * @return {Object} layout
     */
    getLayout(): any {
        return this.hostTree.data.getItemLayout(this.dataIndex);
    }

    getModel<T = unknown>(): Model<T>
    // @depcrecated
    // getModel<T = unknown, S extends keyof T = keyof T>(path: S): Model<T[S]>
    getModel<T = unknown>(path?: string): Model {
        if (this.dataIndex < 0) {
            return;
        }
        const hostTree = this.hostTree;
        const itemModel = hostTree.data.getItemModel(this.dataIndex);
        return itemModel.getModel(path as any);
    }

    // TODO: TYPE More specific model
    getLevelModel(): Model {
        return (this.hostTree.levelModels || [])[this.depth];
    }

    /**
     * @example
     *  setItemVisual('color', color);
     *  setItemVisual({
     *      'color': color
     *  });
     */
    // TODO: TYPE
    setVisual(key: string, value: any): void
    setVisual(obj: Dictionary<any>): void
    setVisual(key: string | Dictionary<any>, value?: any) {
        this.dataIndex >= 0
            && this.hostTree.data.setItemVisual(this.dataIndex, key as any, value);
    }

    /**
     * Get item visual
     * FIXME: make return type better
     */
    getVisual(key: string): unknown {
        return this.hostTree.data.getItemVisual(this.dataIndex, key as any);
    }

    getRawIndex(): number {
        return this.hostTree.data.getRawIndex(this.dataIndex);
    }

    getId(): string {
        return this.hostTree.data.getId(this.dataIndex);
    }

    /**
     * index in parent's children
     */
    getChildIndex(): number {
        if (this.parentNode) {
            const children = this.parentNode.children;
            for (let i = 0; i < children.length; ++i) {
                if (children[i] === this) {
                    return i;
                }
            }
            return -1;
        }
        return -1;
    }

    /**
     * if this is an ancestor of another node
     *
     * @param node another node
     * @return if is ancestor
     */
    isAncestorOf(node: TreeNode): boolean {
        let parent = node.parentNode;
        while (parent) {
            if (parent === this) {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    }

    /**
     * if this is an descendant of another node
     *
     * @param node another node
     * @return if is descendant
     */
    isDescendantOf(node: TreeNode): boolean {
        return node !== this && node.isAncestorOf(this);
    }
};

class Tree<HostModel extends Model = Model, LevelOption = any> {

    type: 'tree' = 'tree';

    root: TreeNode;

    data: List;

    hostModel: HostModel;

    levelModels: Model<LevelOption>[];

    private _nodes: TreeNode[] = [];

    constructor(hostModel: HostModel) {

        this.hostModel = hostModel;
    }
    /**
     * Travel this subtree (include this node).
     * Usage:
     *    node.eachNode(function () { ... }); // preorder
     *    node.eachNode('preorder', function () { ... }); // preorder
     *    node.eachNode('postorder', function () { ... }); // postorder
     *    node.eachNode(
     *        {order: 'postorder', attr: 'viewChildren'},
     *        function () { ... }
     *    ); // postorder
     *
     * @param options If string, means order.
     * @param options.order 'preorder' or 'postorder'
     * @param options.attr 'children' or 'viewChildren'
     * @param cb
     * @param context
     */
    eachNode<Ctx>(options: TreeTraverseOrder, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(options: TreeTraverseOption, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(cb: TreeTraverseCallback<Ctx>, context?: Ctx): void
    eachNode<Ctx>(
        options: TreeTraverseOrder | TreeTraverseOption | TreeTraverseCallback<Ctx>,
        cb?: TreeTraverseCallback<Ctx> | Ctx,
        context?: Ctx
    ) {
        this.root.eachNode(options as TreeTraverseOption, cb as TreeTraverseCallback<Ctx>, context);
    }

    getNodeByDataIndex(dataIndex: number): TreeNode {
        const rawIndex = this.data.getRawIndex(dataIndex);
        return this._nodes[rawIndex];
    }

    getNodeById(name: string): TreeNode {
        return this.root.getNodeById(name);
    }

    /**
     * Update item available by list,
     * when list has been performed options like 'filterSelf' or 'map'.
     */
    update() {
        const data = this.data;
        const nodes = this._nodes;

        for (let i = 0, len = nodes.length; i < len; i++) {
            nodes[i].dataIndex = -1;
        }

        for (let i = 0, len = data.count(); i < len; i++) {
            nodes[data.getRawIndex(i)].dataIndex = i;
        }
    }

    /**
     * Clear all layouts
     */
    clearLayouts() {
        this.data.clearItemLayouts();
    }


    /**
     * data node format:
     * {
     *     name: ...
     *     value: ...
     *     children: [
     *         {
     *             name: ...
     *             value: ...
     *             children: ...
     *         },
     *         ...
     *     ]
     * }
     */
    static createTree<T extends TreeNodeOption, HostModel extends Model, LevelOption>(
        dataRoot: T,
        hostModel: HostModel,
        beforeLink?: (data: List) => void
    ) {

        const tree = new Tree(hostModel);
        const listData: TreeNodeOption[] = [];
        let dimMax = 1;

        buildHierarchy(dataRoot);

        function buildHierarchy(dataNode: TreeNodeOption, parentNode?: TreeNode) {
            const value = dataNode.value;
            dimMax = Math.max(dimMax, zrUtil.isArray(value) ? value.length : 1);

            listData.push(dataNode);

            const node = new TreeNode(convertOptionIdName(dataNode.name, ''), tree);
            parentNode
                ? addChild(node, parentNode)
                : (tree.root = node);

            tree._nodes.push(node);

            const children = dataNode.children;
            if (children) {
                for (let i = 0; i < children.length; i++) {
                    buildHierarchy(children[i], node);
                }
            }
        }

        tree.root.updateDepthAndHeight(0);

        const dimensionsInfo = createDimensions(listData, {
            coordDimensions: ['value'],
            dimensionsCount: dimMax
        });

        const list = new List(dimensionsInfo, hostModel);
        list.initData(listData);

        beforeLink && beforeLink(list);

        linkList({
            mainData: list,
            struct: tree,
            structAttr: 'tree'
        });

        tree.update();

        return tree;
    }

}

/**
 * It is needed to consider the mess of 'list', 'hostModel' when creating a TreeNote,
 * so this function is not ready and not necessary to be public.
 */
function addChild(child: TreeNode, node: TreeNode) {
    const children = node.children;
    if (child.parentNode === node) {
        return;
    }

    children.push(child);
    child.parentNode = node;
}

export default Tree;