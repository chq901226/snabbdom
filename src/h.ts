import { vnode, VNode, VNodeData } from './vnode';
import * as is from './is';

export type VNodes = VNode[];
export type VNodeChildElement = VNode | string | number | undefined | null;
export type ArrayOrElement<T> = T | T[];
export type VNodeChildren = ArrayOrElement<VNodeChildElement>;

function addNS (data: any, children: VNodes | undefined, sel: string | undefined): void {
  data.ns = 'http://www.w3.org/2000/svg';
  if (sel !== 'foreignObject' && children !== undefined) {
    for (let i = 0; i < children.length; ++i) {
      const childData = children[i].data;
      if (childData !== undefined) {
        addNS(childData, (children[i] as VNode).children as VNodes, children[i].sel);
      }
    }
  }
}

export function h(sel: string): VNode;
export function h(sel: string, data: VNodeData | null): VNode;
export function h(sel: string, children: VNodeChildren): VNode;
export function h(sel: string, data: VNodeData | null, children: VNodeChildren): VNode;
export function h (sel: any, b?: any, c?: any): VNode {
  var data: VNodeData = {};
  var children: any;
  var text: any;
  var i: number;
  // 如果有三个参数， 
  if (c !== undefined) {
    // 如果存在data参数
    if (b !== null) {
      data = b;
    }
    // 如果第三个参数是一个数组
    if (is.array(c)) {
      children = c;
      // 如果是一个文本或者数字
    } else if (is.primitive(c)) {
      text = c;
      // 如果是一个 有效的 vnode，包装成统一格式
    } else if (c && c.sel) {
      children = [c];
    }
    // 如果只有两个参数
  } else if (b !== undefined && b !== null) {
    // 如果是数组断定为 children字段
    if (is.array(b)) {
      children = b;
      // 如果是string 或者 number，断定为 text 文本节点
    } else if (is.primitive(b)) {
      text = b;
      // 如果是一个有效的vnode,包装成统一格式
    } else if (b && b.sel) {
      children = [b];
    } else { data = b; }
  }
  
  // 如果存在子类，上面的方法已经把children 处理成一个数组，如果数组里面的值是string或者number类型，那么生成文本节点
  if (children !== undefined) {
    for (i = 0; i < children.length; ++i) {
      if (is.primitive(children[i])) children[i] = vnode(undefined, undefined, undefined, children[i], undefined);
    }
  }
  // 处理svg这种情况
  if (
    sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
    (sel.length === 3 || sel[3] === '.' || sel[3] === '#')
  ) {
    addNS(data, children, sel);
  }
  return vnode(sel, data, children, text, undefined);
};
export default h;
