function Key(delegate) {
	this.delegate = delegate;

	this.handlers = {
		'space': function() {
			if (this.delegate.currentSong != null) {
				this.delegate.currentSong.toggle();
			}
		},
		'left': this.prevSong,
		'up': this.prevSong,
		'right': this.nextSong,
		'down': this.nextSong,
		'0': this.seekBeginning,
		'^': this.seekBeginning,
		'd': function() {
			if (this.delegate.currentSong != null) {
				this.delegate.currentSong.scrollTo();
				this.delegate.currentSong.remove();
			}
		},
		'G': function() {
			var song = $('#songlist').lastElementChild;
			if (song != null) {
				song.scrollTo();
				song.play();
			}
		},
		'g': function() {
			var song = $('#songlist').firstElementChild;
			if (song != null) {
				song.scrollTo();
				song.play();
			}
		},
		'h': function() {
			if (this.delegate.currentSong != null) {
				var a = this.delegate.currentSong.audio;
				if (a.duration > 5) {
					a.currentTime -= 5;
				} else {
					a.currentTime = 0;
				}
			}
		},
		'j': this.nextSong,
		'k': this.prevSong,
		'l': function() {
			if (this.delegate.currentSong != null) {
				var a = this.delegate.currentSong.audio;
				if (a.duration - a.currentTime > 5) {
					a.currentTime += 5;
				} else {
					a.currentTime = a.duration;
				}
			}
		},
		'?': function() {
			var songs = $('#songlist').querySelectorAll('li.song');
			var song = this.delegate.currentSong;

			while (song == null || song == this.delegate.currentSong) {
				var i = Math.floor(Math.random() * songs.length);
				song = songs[i];
			}

			song.scrollTo();
			song.play();
		},
		'`': function() {
			if (this.delegate.currentSong != null) {
				this.delegate.currentSong.scrollTo(); 
			}
		}
	};

	window.addEventListener('keydown', function(e) {
		var group = Key.table[e.which];
		if (group == null) {
			return;
		}
		var target;
		if (e.shiftKey) {
			if (group.length >= 2) {
				target = group[1];
			} else {
				target = group[0].toUpperCase();
			}
		} else {
			target = group[0];
		}
		if (e.ctrlKey) {
			target = 'C-' + target;
		}
		if (e.metaKey || e.altKey) {
			target = 'M-' + target;
		}
		var handler = this.handlers[target];
		if (handler != null) {
			e.preventDefault();
			e.stopPropagation();
			handler.call(this, e);
		}
	}.bind(this), false);
};

Key.prototype.prevSong = function() {
	if (this.delegate.currentSong == null) { return; }

	this.delegate.currentSong.prev();

	if (this.delegate.currentSong.offsetTop < window.scrollY) {
		this.delegate.currentSong.scrollTo();
	}
};

Key.prototype.nextSong = function() {
	if (this.delegate.currentSong == null) { return; }

	this.delegate.currentSong.next();

	var screenBottom = window.scrollY + window.innerHeight;
	var songBottom = this.delegate.currentSong.offsetTop + this.delegate.currentSong.offsetHeight;
	if ((songBottom + $('header').offsetHeight) > screenBottom) {
		this.delegate.currentSong.scrollToBottom();
	}
};

Key.prototype.seekBeginning = function() {
	if (this.delegate.currentSong != null) {
		this.delegate.currentSong.audio.currentTime = 0;
	}
};


Key.table = {
	32:   ['space'],
	37:   ['left'],
	38:   ['up'],
	39:   ['right'],
	40:   ['down'],
	48:   ['0', ')'],
	54:   ['6', '^'],
	68:   ['d'],
	71:   ['g'],
	72:   ['h'],
	74:   ['j'],
	75:   ['k'],
	76:   ['l'],
	191:  ['/', '?'],
	192:  ['`', '~']
};
