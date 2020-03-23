import { VNode, VNodeData } from '../vnode';
import { Module } from './module';
/***
 * snabbdom 的 eventlistener 并没有实现事件委托机制
 * 
 */

// 声明一种是原生的事件，一个可以是自定义的事件
export type On = {
  [N in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[N]) => void
} & {
  [event: string]: EventListener
};

function invokeHandler (handler: any, vnode?: VNode, event?: Event): void {
  if (typeof handler === 'function') {
    // call function handler
    handler.call(vnode, event, vnode);
  } else if (typeof handler === 'object') {
    // call handler with arguments
    if (typeof handler[0] === 'function') {
      // special case for single argument for performance
      if (handler.length === 2) {
        handler[0].call(vnode, handler[1], event, vnode);
      } else {
        var args = handler.slice(1);
        args.push(event);
        args.push(vnode);
        handler[0].apply(vnode, args);
      }
    } else {
      // call multiple handlers
      for (var i = 0; i < handler.length; i++) {
        invokeHandler(handler[i], vnode, event);
      }
    }
  }
}

function handleEvent (event: Event, vnode: VNode) {
  var name = event.type;
  var on = (vnode.data as VNodeData).on;

  // call event handler(s) if exists
  if (on && on[name]) {
    invokeHandler(on[name], vnode, event);
  }
}

function createListener () {
  return function handler (event: Event) {
    // 将vnode挂载到 listener 的用意
    handleEvent(event, (handler as any).vnode);
  };
}

function updateEventListeners (oldVnode: VNode, vnode?: VNode): void {
  var oldOn = (oldVnode.data as VNodeData).on;
  var oldListener = (oldVnode as any).listener;
  var oldElm: Element = oldVnode.elm as Element;
  var on = vnode && (vnode.data as VNodeData).on;
  var elm: Element = (vnode && vnode.elm) as Element;
  var name: string;

  // optimization for reused immutable handlers
  if (oldOn === on) {
    return;
  }

  // 可以复用的进行复用，不可以服用的就删除掉；这里主要是删除之前的一些事件
  // remove existing listeners which no longer used
  if (oldOn && oldListener) {
    // if element changed or deleted we remove all existing listeners unconditionally
    if (!on) {
      for (name in oldOn) {
        // remove listener if element was changed or existing listeners removed
        oldElm.removeEventListener(name, oldListener, false);
      }
    } else {
      for (name in oldOn) {
        // remove listener if existing listener removed
        if (!on[name]) {
          oldElm.removeEventListener(name, oldListener, false);
        }
      }
    }
  }
  // 这里是处理新绑定的一些事件，如果存在复用旧的事件，就跳过不再绑定
  // add new listeners which has not already attached
  if (on) {
    // reuse existing listener or create new
    var listener = (vnode as any).listener = (oldVnode as any).listener || createListener();
    // update vnode for listener
    listener.vnode = vnode;

    // if element changed or added we add all needed listeners unconditionally
    if (!oldOn) {
      for (name in on) {
        // add listener if element was changed or new listeners added
        elm.addEventListener(name, listener, false);
      }
    } else {
      for (name in on) {
        // add listener if new listener added
        if (!oldOn[name]) {
          elm.addEventListener(name, listener, false);
        }
      }
    }
  }
}

export const eventListenersModule = {
  create: updateEventListeners,
  update: updateEventListeners,
  destroy: updateEventListeners
} as Module;
export default eventListenersModule;
