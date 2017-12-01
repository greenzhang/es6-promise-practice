/**
 * 构建一个es6的promise
 * 需要注意如下几点:
 * 1.promise概括来说是对异步执行结果的描述对象
 * 2.标准规定的只有一个then函数,甚至没有规定构造函数
 * 3.then方法返回一个全新的promise 
 * 4.promise的状态只有三种 pending-fulfilled-rejected 一旦状态由pending转为后两种状态,则无法改变.此过程被成为settle
 * 
 */
function isFunction(fn) {
    return fn && typeof fn === 'function'
}

function isObject(obj) {
    return obj != null && typeof obj === 'object'
}
const PENDING = 0;
const FULFILLED = 1;
const REJECTED = 2;
class Promise {
    constructor(executor) {
        if (!isFunction(executor)) {
            throw new TypeError(`Promise resolver ${executor} is not a function.`)
        }
        this.status = PENDING;
        this.data;
        // 分别为promise resolve/rejected的回调函数集
        // 因为在promise结束之前,可能由多个then挂在该promise上,即有多个回调事件
        // 构造函数接收一个executor函数,函数中的操作执行结束后,若成功,调用resolve并传入value;若失败,调用reject并传入reason
        this.onFulFulledCB = [];
        this.onRejectedCB = [];
        this.execute(executor)
    }
    static deferred() {
        const dfd = {}
        dfd.promise = new Promise((resolve, reject) => {
            dfd.resolve = resolve
            dfd.reject = reject
        })
        return dfd
    }
    execute(executor) {
        const self = this;
        // resolve和reject这里的setTimeout是为了异步执行所有的回调函数
        function resolve(value) {
            setTimeout(() => {
                if (self.status !== PENDING) {
                    return
                }
                self.status = FULFILLED;
                self.data = value
                let fn;
                for (let i = 0; i < self.onFulFulledCB.length; i++) {
                    fn = self.onFulFulledCB[i]
                    fn.call(self, value)
                }
            })
        }

        function reject(reason) {
            setTimeout(() => {
                if (self.status !== PENDING) {
                    return
                }
                self.status = REJECTED;
                self.data = reason;
                let fn;
                for (let i = 0; i < self.onRejectedCB.length; i++) {
                    fn = self.onRejectedCB[i]
                    fn.call(self, reason)
                }
            })
        }
        try {
            executor(resolve, reject)
        } catch (error) {
            reject(error)
        }
    }
    then(onFulfilled, onRejected) {
        // onFulfilled和onRejected都是可选参数
        // 如果这两个参数哪个不是函数,必被忽略
        /**
         * 在对于如下情况,promise的值应该向后传递(规则规定)
         * new Promise(resolve => resolve(2))
         * .then()
         * .then(value => {
         *  console.log(value)
         * })
         * 为了实现如上行为,需要判断onResolved和onRejected是否是函数
         * 如果为空需要自行实现一个函数,将值return出来
         */
        onFulfilled = isFunction(onFulfilled) ? onFulfilled : function (v) {
            return v
        }
        onRejected = isFunction(onRejected) ? onRejected : function (r) {
            throw r
        }
        // then方法返回一个新的Promise对象
        // then方法的两个回调函数执行过程中可能抛出异常,所以在执行时需要用try-catch包起来

        const promise2 = new Promise((resolve, reject) => {
            switch (this.status) {
                case PENDING:
                // 如果当前的Promise还是pending状态,需要等到状态确定后才能进行处理
                // 所以要把两种情况的处理逻辑放入各自情况的回调集里
                
                    this.onFulFulledCB.push((value) => {
                        try {
                            var x = onFulfilled(value)
                            Promise.RESOLVE_PROMISE(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                    this.onRejectedCB.push((reason) => {
                        try {
                            var x = onRejected(reason)
                            Promise.RESOLVE_PROMISE(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                    break
                case FULFILLED:
                    setTimeout(() => {
                        try {
                            var x = onFulfilled(this.data)
                            Promise.RESOLVE_PROMISE(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                    break
                case REJECTED:
                    setTimeout(() => {
                        try {
                            var x = onRejected(this.data)
                            Promise.RESOLVE_PROMISE(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                    break
            }
        })
        return promise2
    }
    /*
    RESOLVE_PROMISE函数即为根据x的值来决定promise2的状态的函数
    也即标准中的[Promise Resolution Procedure](https://promisesaplus.com/#point-47)
    x为`promise2 = promise1.then(onResolved, onRejected)`里`onResolved/onRejected`的返回值
    `resolve`和`reject`实际上是`promise2`的`executor`的两个实参，因为很难挂在其它的地方，所以一并传进来。
    */
    static RESOLVE_PROMISE(promise, x, resolve, reject) {
        let then;
        /**
         * onFulfilled和onRejected在promise执行结束后必须被调用,其第一个参数为promise的值
         * 在promise执行结束前其不可被调用,调用次数不可超过一次
         */
        let isCalled = false;
        if (promise === x) {
            reject(new TypeError('Chaining cycle detected for promise!'))
            return
        }
        if (x instanceof Promise) {
            // 
            if (x.status === PENDING) {
                x.then(function (v) {
                    Promise.RESOLVE_PROMISE(promise, v, resolve, reject)
                }, reject)
            } else {
                // 状态确定之后,必定有一个值
                x.then(resolve, reject)
            }
            return
        }
        if (x !== null && (isObject(x) || isFunction(x))) {
            try {
                then = x.then
                if (isFunction(then)) {
                    then.call(x, function _resolve(v) {
                        if (isCalled) {
                            return
                        }
                        isCalled = true;
                        Promise.RESOLVE_PROMISE(promise, v, resolve, reject)
                    }, function _reject(r) {
                        if (isCalled) {
                            return
                        }
                        isCalled = true;
                        reject(r)
                    })
                } else {
                    resolve(x)
                }
            } catch (error) {
                if (isCalled) {
                    return
                }
                isCalled = true
                reject(error)
            }
        } else {
            resolve(x)
        }
    }
}
try {
    module.exports = Promise
} catch (error) {
    
}
