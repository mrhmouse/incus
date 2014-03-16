package main

import (
	"time"
	"sync"
)

type Debouncer struct {
	bounces map[string]func()
    mutex   *sync.Mutex
}

func newDebouncer() *Debouncer {
	return &Debouncer{make(map[string]func()), &sync.Mutex{}}
}

func (this *Debouncer) add(key string, wait int, fn func()) {
	this.mutex.Lock()
	defer this.mutex.Unlock()

	_, exists := this.bounces[key]

    this.bounces[key] = fn

    if(!exists) {
    	this.setTimeout(key, wait)
    }
}

func (this *Debouncer) setTimeout(key string, wait int) {
	go func() {
		time.Sleep(time.Duration(wait) * time.Second)
    	
    	this.mutex.Lock()

    	fn, exists := this.bounces[key]
    	if(exists) {
    		delete(this.bounces, key)
    	}

    	this.mutex.Unlock()

    	if(exists) {
    		fn()
    	}

	}()
}


