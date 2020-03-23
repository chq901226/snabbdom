import { VNode, VNodeData } from './vnode';
import { h } from './h';

/**
 * 传名调用,性能优化
 */
export interface ThunkData extends VNodeData {
  fn: () => VNode
  args: any[]
}

// thunk是 vnode 的一个子级，他比普通的vnode,data上多了fn,args，并且给与重写了init、prepatch的声明周期hook
export interface Thunk extends VNode {
  data: ThunkData
}

export interface ThunkFn {
  (sel: string, fn: Function, args: any[]): Thunk
  (sel: string, key: any, fn: Function, args: any[]): Thunk
}

function copyToThunk (vnode: VNode, thunk: VNode): void {
  thunk.elm = vnode.elm;
  (vnode.data as VNodeData).fn = (thunk.data as VNodeData).fn;
  (vnode.data as VNodeData).args = (thunk.data as VNodeData).args;
  thunk.data = vnode.data;
  thunk.children = vnode.children;
  thunk.text = vnode.text;
  thunk.elm = vnode.elm;
}

// 生成元素的hook init; 将使用renderFn生成的vnode 的属性复制到 thunk上；
function init (thunk: VNode): void {
  const cur = thunk.data as VNodeData;
  const vnode = (cur.fn as any).apply(undefined, cur.args);
  copyToThunk(vnode, thunk);
}

// 生成元素的hook init
function prepatch (oldVnode: VNode, thunk: VNode): void {
  let i: number;
  const old = oldVnode.data as VNodeData;
  const cur = thunk.data as VNodeData;
  const oldArgs = old.args;
  const args = cur.args;
  //如果两个节点的回调函数不一样 或者 参数的个数不一致，重新生成一个vnode 并绑定到thunk上
  if (old.fn !== cur.fn || (oldArgs as any).length !== (args as any).length) {
    copyToThunk((cur.fn as any).apply(undefined, args), thunk);
    return;
  }
  // 如果参数的个数一致，那么判断每个参数是否一致，如果不一致那么重新生成
  for (i = 0; i < (args as any).length; ++i) {
    if ((oldArgs as any)[i] !== (args as any)[i]) {
      copyToThunk((cur.fn as any).apply(undefined, args), thunk);
      return;
    }
  }
  copyToThunk(oldVnode, thunk);
}

export const thunk = function thunk (sel: string, key?: any, fn?: any, args?: any): VNode {
  if (args === undefined) {
    args = fn;
    fn = key;
    key = undefined;
  }
  return h(sel, {
    key: key,
    hook: { init, prepatch },
    fn: fn,
    args: args
  });
} as ThunkFn;

export default thunk;
