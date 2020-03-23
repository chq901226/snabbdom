import { Module } from './modules/module';
import vnode, { VNode } from './vnode';
import * as is from './is';
import htmlDomApi, { DOMAPI } from './htmldomapi';

type NonUndefined<T> = T extends undefined ? never : T;

function isUndef(s: any): boolean {
  return s === undefined;
}
function isDef<A>(s: A): s is NonUndefined<A> {
  return s !== undefined;
}

type VNodeQueue = VNode[];

const emptyNode = vnode('', {}, [], undefined, undefined);

// 如果key相同或者选择器相同，就断定是个相同的vnode
function sameVnode(vnode1: VNode, vnode2: VNode): boolean {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function isVnode(vnode: any): vnode is VNode {
  return vnode.sel !== undefined;
}

type KeyToIndexMap = { [key: string]: number };

type ArraysOf<T> = {
  [K in keyof T]: Array<T[K]>;
};

type ModuleHooks = ArraysOf<Module>;

function createKeyToOldIdx(children: VNode[], beginIdx: number, endIdx: number): KeyToIndexMap {
  const map: KeyToIndexMap = {};
  for (let i = beginIdx; i <= endIdx; ++i) {
    const key = children[i]?.key;
    if (key !== undefined) {
      map[key] = i;
    }
  }
  return map;
}

const hooks: Array<keyof Module> = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];

export { h } from './h';
export { thunk } from './thunk';

export function init(modules: Array<Partial<Module>>, domApi?: DOMAPI) {
  let i: number;
  let j: number;
  const cbs = ({} as ModuleHooks);

  const api: DOMAPI = domApi !== undefined ? domApi : htmlDomApi;
  // 收集module的所有hook函数，如果你自己写了个module，那么也会被收集起来,处理成
  /**
   *  interface cbs {
   *    create?: Array<()=>void>
   *    ...
   *  }
   *
   */
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      const hook = modules[j][hooks[i]];
      if (hook !== undefined) {
        (cbs[hooks[i]] as any[]).push(hook);
      }
    }
  }

  // 此方法根据传入dom的id和class，作为他的sel然后生成一个 vnode
  function emptyNodeAt(elm: Element) {
    const id = elm.id ? '#' + elm.id : '';
    const c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
    return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
  }

  function createRmCb(childElm: Node, listeners: number) {
    return function rmCb() {
      // 这里的listeners 为了确保在最后一个rm里面再删除掉真实的dom
      if (--listeners === 0) {
        const parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  // 根据vnode 创建 真实的dom
  function createElm(vnode: VNode, insertedVnodeQueue: VNodeQueue): Node {
    let i: any;
    let data = vnode.data;
    // hook 都放在data 对象里 椒盐虾data
    if (data !== undefined) {
      const init = data.hook?.init;
      if (isDef(init)) {
        init(vnode);
        data = vnode.data;
      }
    }
    const children = vnode.children;
    const sel = vnode.sel;
    // h('!') 生成一个注释节点
    if (sel === '!') {
      if (isUndef(vnode.text)) {
        vnode.text = '';
      }
      vnode.elm = api.createComment(vnode.text!);
      // 有效的sel
    } else if (sel !== undefined) {
      // Parse selector 为了得出一个tagName
      const hashIdx = sel.indexOf('#');
      const dotIdx = sel.indexOf('.', hashIdx);
      const hash = hashIdx > 0 ? hashIdx : sel.length;
      const dot = dotIdx > 0 ? dotIdx : sel.length;
      const tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      // end Parse selector
      // 创建元素
      const elm = vnode.elm = isDef(data) && isDef(i = data.ns)
        ? api.createElementNS(i, tag)
        : api.createElement(tag);
      // 设置 sel提供的id
      if (hash < dot) elm.setAttribute('id', sel.slice(hash + 1, dot));
      // 设置 selt提供的class
      if (dotIdx > 0) elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
      // 调用 modules 的 create hook
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode);
      // 递归构建子级dom对象
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          const ch = children[i];
          if (ch != null) {
            api.appendChild(elm, createElm(ch as VNode, insertedVnodeQueue));
          }
        }
        // 文本节点
      } else if (is.primitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      // 执行当前vnode的 hook
      const hook = vnode.data!.hook;
      if (isDef(hook)) {
        hook.create?.(emptyNode, vnode);
        // 如果当前的这个vnode有定义insert hook
        if (hook.insert) {
          insertedVnodeQueue.push(vnode);
        }
      }
    } else {
      vnode.elm = api.createTextNode(vnode.text!);
    }
    return vnode.elm;
  }

  function addVnodes(
    parentElm: Node,
    before: Node | null,
    vnodes: VNode[],
    startIdx: number,
    endIdx: number,
    insertedVnodeQueue: VNodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      if (ch != null) {
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
      }
    }
  }

  // 触发当前和子集所有的destory hook
  function invokeDestroyHook(vnode: VNode) {
    const data = vnode.data;
    if (data !== undefined) {
      // 触发自身的destory
      data?.hook?.destroy?.(vnode);
      // 触发module的hook
      for (let i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
      if (vnode.children !== undefined) {
        for (let j = 0; j < vnode.children.length; ++j) {
          const child = vnode.children[j];
          if (child != null && typeof child !== 'string') {
            invokeDestroyHook(child);
          }
        }
      }
    }
  }

  function removeVnodes(parentElm: Node,
    vnodes: VNode[],
    startIdx: number,
    endIdx: number): void {
    for (; startIdx <= endIdx; ++startIdx) {
      let listeners: number;
      let rm: () => void;
      const ch = vnodes[startIdx];
      if (ch != null) {
        if (isDef(ch.sel)) {
          invokeDestroyHook(ch);
          // 这里的listeners 为了确保在最后一个rm里面再删除掉真实的dom
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm!, listeners);
          // 调用 modules 的 remove hook
          for (let i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm);
          // 触发当前的remove hook，不涉及该vnode的子类
          const removeHook = ch?.data?.hook?.remove;
          // 是否重写了removeHook，如果定了 手动调用rm,默认直接删除
          if (isDef(removeHook)) {
            removeHook(ch, rm);
          } else {
            rm();
          }
        } else { // Text node
          api.removeChild(parentElm, ch.elm!);
        }
      }
    }
  }

  // 更新孩子节点
  function updateChildren(parentElm: Node,
    oldCh: VNode[],
    newCh: VNode[],
    insertedVnodeQueue: VNodeQueue) {
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let oldStartVnode = oldCh[0];
    let oldEndVnode = oldCh[oldEndIdx];
    let newEndIdx = newCh.length - 1;
    let newStartVnode = newCh[0];
    let newEndVnode = newCh[newEndIdx];
    let oldKeyToIdx: KeyToIndexMap | undefined;
    let idxInOld: number;
    let elmToMove: VNode;
    let before: any;

    // 同层级比较，猜测性的去断定怎么移动，先判断最可能的情况，理论上 循环的长度取决于 数组较小的ch
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // 找新旧 有效的节点
      if (oldStartVnode == null) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
      } else if (oldEndVnode == null) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (newStartVnode == null) {
        newStartVnode = newCh[++newStartIdx];
      } else if (newEndVnode == null) {
        newEndVnode = newCh[--newEndIdx];

        // 相同继续对比
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];

      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];

        // 向右移动
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm!, api.nextSibling(oldEndVnode.elm!));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];

        // 向左移动
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm!, oldStartVnode.elm!);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];


      } else {
        // 缓存所有老节点在 oldCh里面的位置
        if (oldKeyToIdx === undefined) {
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        }
        // 拿新的vnode 看存在不存在 oldCh 里面
        idxInOld = oldKeyToIdx[newStartVnode.key as string];
        // 如果oldCh不存在这个key
        if (isUndef(idxInOld)) { // New element
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm!);
        } else {
          elmToMove = oldCh[idxInOld];
          // 如果两个sel 不一致的话，那重新生成一个
          if (elmToMove.sel !== newStartVnode.sel) {
            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm!);
          } else {
            // 如果一致，继续比较 并且移动它的位置
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
            oldCh[idxInOld] = undefined as any;
            api.insertBefore(parentElm, elmToMove.elm!, oldStartVnode.elm!);
          }
        }
        newStartVnode = newCh[++newStartIdx];
      }
    }
    // 循环之后
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      // 在old后面新增的那种情况
      if (oldStartIdx > oldEndIdx) {
        before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
        addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
      } else {
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
      }
    }
  }

  function patchVnode(oldVnode: VNode, vnode: VNode, insertedVnodeQueue: VNodeQueue) {
    const hook = vnode.data?.hook;
    // 如果存在hook.prepatch，那么就调用，函数参数的传递都是值的传递，这里会将两个参数的引用或者叫指针传递到函数
    // 内部执行，prepatch 内容会改变oldVnode和vnode的值
    hook?.prepatch?.(oldVnode, vnode);
    // 如果oldVnode.elm 存在，https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator
    const elm = vnode.elm = oldVnode.elm!;
    const oldCh = oldVnode.children as VNode[];
    const ch = vnode.children as VNode[];
    // 如果两个节点的指针一致，那么直接返回;这个地方是thunk的精妙所在
    if (oldVnode === vnode) return;
    // 处理vnode的data更新，执行每个 modules 的 update hook
    if (vnode.data !== undefined) {
      for (let i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      // 执行当前vnode的update
      vnode.data.hook?.update?.(oldVnode, vnode);
    }
    // 再次 比较是否相同
    // 如果没有指定text,说明不是文本节点
    if (isUndef(vnode.text)) {
      // 如果都有孩子，那么更新孩子
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue);
        // 如果vnode有孩子,oldvnode 没有，那vnode新增
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) api.setTextContent(elm, '');
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
        // 如果旧的有孩子，新的没有，那么删除掉孩子
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
        // 如果oldnode 是文本节点，vnode没有文本，俩个都没有孩子
      } else if (isDef(oldVnode.text)) {
        api.setTextContent(elm, '');
      }
      // 如果是两个文   本不一致，这种情况是新的节点有文本，老的节点文本和它不一致
    } else if (oldVnode.text !== vnode.text) {
      // 如果不是文本节点，删除掉孩子
      if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      }
      // 重新设置文本内容
      api.setTextContent(elm, vnode.text!);
    }
    // 更新之后
    hook?.postpatch?.(oldVnode, vnode);
  }

  // 返回一个patch 函数
  return function patch(oldVnode: VNode | Element, vnode: VNode): VNode {
    let i: number, elm: Node, parent: Node;
    const insertedVnodeQueue: VNodeQueue = [];
    // 调用之后会执行 pre hook 的函数
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]();

    // 如果旧的vnode 不存在
    if (!isVnode(oldVnode)) {
      // 生成一个vnode
      oldVnode = emptyNodeAt(oldVnode);
    }

    // 简单的判断是不是一个node,看key和sel是不是一致，如果一致进一步的判断，如果不一致，那么肯定不是相同的node
    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm!;
      parent = api.parentNode(elm);

      createElm(vnode, insertedVnodeQueue);
      //
      if (parent !== null) {
        // 将vnode插入到oldVnode之前
        api.insertBefore(parent, vnode.elm!, api.nextSibling(elm));
        // 删除老节点
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }

    // 为了让vnode的hook insert 可以传递正确的 vnode 参数
    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      insertedVnodeQueue[i].data!.hook!.insert!(insertedVnodeQueue[i]);
    }
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]();
    return vnode;
  };
}
