package main

import "ktkr.us/pkg/airlift/shorthash"

const hashLen = 9

var conf = Config{50}

type Config struct {
	maxCount int
}

func (c Config) MaxAge() int    { return 0 }
func (c Config) MaxSize() int64 { return 0 }
func (c Config) MaxCount() int  { return c.maxCount }

func (c Config) ProcessHash(buf []byte) string {
	return shorthash.Memorable(buf, 9)
}

func (Config) Refresh() {}
