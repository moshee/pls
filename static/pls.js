function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function percent(cur, max) {
	return (cur/max)*100 + '%';
}

function formatDuration(n) {
	var mins = Math.floor(n/60);
	var secs = Math.round(n % 60);
	if (secs == 60) {
		mins++;
		secs = 0;
	}
	if (secs <= 9) {
		secs = '0' + secs;
	}
	return mins + ':' + secs;
}

// Seems like Chrome has a non-standard "items" property of the FileTransfer
// object which already contains MIME types when a dragenter occurs. We can use
// this to try to give some negative feedback early.
function isAudioFile(items) {
	if (items == null) {
		return true;
	}
	for (var i = 0, item; item = items[i]; i++) {
		if (item.kind == 'file' && item.type.indexOf('audio/') == 0) {
			return true;
		}
	}

	return false;
}

function getURLParams() {
	var components = window.location.pathname.split('/');
	var id = components[1];
	var filename = components[2];
	return { "id": id, "filename": filename };
}

function xhr(url, mutate, cb) {
	var x = new XMLHttpRequest();

	x.addEventListener('load', function(e) {
		cb(e.target);
	}, false);

	mutate(x);

	x.open('GET', url);
	x.send();
}

function json(url, cb) {
	xhr(url, null, function(x) {
		var obj = {};
		try {
			obj = JSON.parse(x.responseText);
		} catch (e) {
			console.log(e);
			return;
		}
		cb(obj);
	});
}

/*
 * Diff two lists and execute callbacks on diffed items. Naïve diff algorithm
 * with bad time complexity is easy to implement and suitable for small lists.
 *
 * a, b Array<T>: lists to compare
 * cmp function(T, T): comparator function
 * add, rem function(T, int, Array<T>): Array forEach callbacks to execute on
 * added and removed items
 */
function diff(a, b, cmp, add, rem) {
	var addlist = [];
	var remlist = [];

	var ia = ib = 0;
	var ja, jb, xa, xb;

	for (;;) {
		xa = a[ia];
		xb = b[ib];

		if (!cmp(xa, xb)) {
			var found = false;

			// check if old has more
			for (ja = ia; xa = a[ja]; ja++) {
				if (cmp(xa, xb)) {
					found = true;
					// old has more - should delete them
					for (var i = ia; i < ja; i++) {
						remlist.push(a[i]);
					}
					ia = ja;
					break;
				}
			}

			if (!found) {
				// check if new has more
				for (jb = ib; xb = b[jb]; jb++) {
					if (cmp(xa, xb)) {
						found = true;
						for (var i = ib; i < jb; i++) {
							addlist.push(b[i]);
						}
						ib = jb;
						break;
					}
				}
			}

			if (!found) {
				// the new one is completely different; complete replacement
				remlist = a;
				addlist = b;
				break;
			}
		}
	}

	remlist.forEach(rem);
	addlist.forEach(add);
}

var Pls = {
	init: function(opts) {
		this.haveAudioAPI = false;
		var that = this;

		var cookies = document.cookie.split(';');
		window.cookies = {};
		for (var i = 0, cookie; cookie = cookies[i]; i++) {
			var pair = cookie.split('=');
			window.cookies[pair[0]] = pair[1];
		}

		window.addEventListener('DOMContentLoaded', function() {
			this.shroud = $('#shroud');
			this.follower = $('#follower');
			if (window.Visual != null) {
				try {
					this.ctx = new (window.AudioContext || window.webkitAudioContext)();
					this.haveAudioAPI = true;
					this.analyser = this.ctx.createAnalyser();
					this.analyser.connect(this.ctx.destination);
					this.vis = new Visual($('#vis'), this.analyser, 5, opts.vis.bars || 32);
				} catch (e) { 
					console.log(e);
				}
			}

			var songs = $$('li.song');
			for (var i = 0, song; song = songs[i]; i++) {
				this.hookSong(song);
			}

			this.hookFollower(this.follower);

			/*
			 * drag over -> show follower without loader bar
			 * drag exit -> hide follower with animation
			 * drop -> do upload -> hide follower with animation
			 */

			if (window.Key != null) {
				this.key = new Key(this);
			}

			this.form = $('#file-upload');
			this.form.addEventListener('change', function() {
				if (this.files.length == 0 || this.files[0].type.indexOf('audio/') != 0) {
					return;
				}
				this.style.visibility = 'hidden';
				this.style.display = 'block';
				that.follower.setPos(window.innerWidth/2, window.innerHeight/2);
				this.style.display = 'none';
				this.style.visibility = '';
				that.follower.show();
				that.upload(this.files[0]);
			}, false);

			$('#upload').addEventListener('click', function() {
				this.form.click();
			}.bind(this), false);

			document.body.addEventListener('dragenter',  this.dragenter.bind(this),  false);
			this.shroud.addEventListener('dragover',     this.dragover.bind(this),   false);
			this.shroud.addEventListener('dragleave',    this.dragleave.bind(this),  false);
			this.shroud.addEventListener('drop',         this.drop.bind(this),       false);

			window.addEventListener('popstate', function(e) {
				var id;
				if (e.state != null) {
					id = e.state.id;
				} else {
					if (window.location.pathname == '/') {
						if (this.currentSong != null) {
							this.currentSong.stop();
							this.currentSong.disable();
						}
						return;
					} else {
						id = getURLParams().id;
					}
				}
				this.playID(id);
			}.bind(this), false);

			if (window.location.pathname != "/") {
				var params = getURLParams();
				this.playID(params.id);
				history.replaceState(params, params.filename, window.location.pathname);
			}
		}.bind(this));
	},

	dragenter: function(e) {
		if (!isAudioFile(e.dataTransfer.items)) {
			e.dataTransfer.dropEffect = 'none';
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		this.follower.setPosEvent(e);
		this.shroud.classList.add('active');
		this.follower.show();
		e.dataTransfer.dropEffect = 'copy';
	},

	dragover: function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.follower.setPosEvent(e);
		this.follower.show();
	},

	dragleave: function(e) {
		// get rid of thing
		e.preventDefault();
		e.stopPropagation();
		this.shroud.classList.remove('active');
		this.follower.hide();
	},

	drop: function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.shroud.classList.remove('active');

		var files = e.dataTransfer.files;
		if (files.length == 0) {
			this.follower.hide();
			return;
		}

		audioFiles = [];

		for (var i = 0, file; file = files[i]; i++) {
			// According to the standard FileTransfer object, this is the
			// proper place to check for file type
			if (file.type.indexOf('audio/') == 0) {
				audioFiles.push(file);
			}
		}

		if (audioFiles.length == 0) {
			this.follower.hide();
			return;
		}

		this.upload(audioFiles);
	},

	playID: function(id) {
		var song = $('[data-id="' + id + '"]');
		if (song == null) {
			return;
		}

		var secs;
		var fragment = window.location.hash;

		if (fragment != "") {
			var parts = fragment.slice(1).split(':');
			var mins = hrs = 0;

			if (parts.length >= 1) {
				secs = parseInt(parts[parts.length-1]);
				if (parts.length >= 2) {
					mins = parseInt(parts[parts.length-2]);
					if (parts.length >= 3) {
						hrs = parseInt(parts[parts.length-3]);
					}
				}
			}

			if (isNaN(secs) || isNaN(mins)) {
				return;
			}

			secs += mins*60;
			if (!isNaN(hrs)) {
				secs += hrs*60*60;
			}
		}

		song.scrollTo();
		song.play(secs);
	},

	upload: function(files) {
		this.uploadFiles(files);
	},

	uploadFiles: function(files) {
		var x = new XMLHttpRequest();
		this.loader.reset();
		var file = files.shift();

		x.upload.addEventListener('progress', function(e) {
			if (e.lengthComputable) {
				this.loader.setProgress(e.loaded / e.total);
			}
		}.bind(this), false);

		x.upload.addEventListener('load', function() {
			this.loader.setProgress(1);
		}.bind(this), false);

		x.addEventListener('load', function(e) {
			if (e.target.status !== 201) {
				var err = JSON.parse(e.target.responseText);
				this.showMessage($('#upload'), err.Error, 'bad');
			} else {
				this.insertSong(e.target.response.querySelector('li.song'));
			}

			if (files.length > 0) {
				this.uploadFiles(files);
			} else {
				// all done
				this.follower.hide();
			}
		}.bind(this), false);

		x.addEventListener('cancel', function() {
			this.follower.hide();
		}.bind(this), false);

		// TODO: put a cancel button in the middle of the loader

		x.responseType = 'document';
		x.open('POST', '/upload', true);
		x.setRequestHeader('X-Pls-Filename', encodeURIComponent(file.name));
		x.send(file);
	},

	insertSong: function(song) {
		if (song == null) {
			return;
		}
		var songList = $('#songlist');
		songList.insertBefore(song, songList.firstElementChild);
		var trackCount = $('#track-count');
		trackCount.innerText = parseInt(trackCount.innerText) + 1;
		this.hookSong(song);
		song.classList.remove('fresh');
	},

	showMessage: function(source, msg, klass) {
		alert(msg);
	},

	clickOffset: function(e) {
		if (e.changedTouches != null && e.changedTouches.length >= 1) {
			var t = e.changedTouches[0];
			return t.clientX - t.target.clientLeft;
		}
		return e.offsetX;
	},

	hookAudio: function(audio) {
		var that = this;

		audio.track           = audio.parentElement.querySelector('.player-track');
		audio.track.audio     = audio;
		audio.track.bar       = audio.track.querySelector('.playback-bar');
		audio.track.bufferBar = audio.track.querySelector('.buffer-bar');

		var mousemove = function(e) {
			if (e.buttons === 1 || e.type === 'touchmove') {
				e.stopPropagation();
				e.preventDefault();
				this.dragging = true;
				var offset = Pls.clickOffset(e);
				this.bar.style.width = percent(offset, this.offsetWidth);
				this.audio.song.currentTime.innerText = this.audio.song.currentTime.textContent = formatDuration(this.audio.duration * (offset/this.offsetWidth)) + '/';
			}
		};
		var mouseup = function(e) {
			e.preventDefault();
			e.stopPropagation();
			this.dragging = false;
			this.audio.wasPaused = this.audio.paused;
			var seek = function() {
				this.removeEventListener('seeked', seek);
				if (!this.wasPaused) {
					this.audio.muted = false;
					this.play();

					// required to get around Chrome's new crappy anti-autoplay implementation
					// https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
					that.ctx.resume();
				}
			};
			this.audio.addEventListener('seeked', seek, false);
			this.audio.pause();
			this.audio.currentTime = this.audio.duration * (Pls.clickOffset(e) / this.offsetWidth);
		};
		var mouseleave = function(e) { this.mouseLeft = true; };
		var mouseenter = function(e) { this.mouseLeft = false; };
		var touchonly = function(f) {
			return function(e) {
				e.preventDefault();
				f(e);
			};
		};

		audio.track.addEventListener('touchstart', function(e) {
			e.preventDefault();
			e.stopPropagation();
		}, false);

		audio.track.addEventListener('mousemove',   mousemove,   false);
		audio.track.addEventListener('touchmove',   mousemove,   false);
		audio.track.addEventListener('mouseup',     mouseup,     false);
		audio.track.addEventListener('touchend',    mouseup,     false);
		audio.track.addEventListener('mouseleave',  mouseleave,  false);
		audio.track.addEventListener('touchleave',  mouseleave,  false);
		audio.track.addEventListener('mouseenter',  mouseenter,  false);
		audio.track.addEventListener('touchenter',  mouseenter,  false);

		audio.addEventListener('timeupdate', function(e) {
			if (!this.track.dragging || this.track.mouseLeft) {
				this.track.bar.style.width = percent(this.currentTime, this.duration);
				this.song.currentTime.innerText = this.song.currentTime.textContent = formatDuration(this.currentTime) + '/';
			}
		}, false);

		audio.addEventListener('playing', function() {
			this.song.classList.remove('loading');
			this.song.classList.add('active');
			this.track.classList.add('active');
			this.track.classList.remove('inactive');
			if (that.vis != null) {
				that.vis.start();
			}
			this.song.setTitle('▶');
		}, false);

		audio.addEventListener('pause', function() {
			if (this.currentTime >= this.duration) {
				this.song.disable();
				this.song.next();
			} else {
				this.song.classList.remove('active');
			}
			if (that.vis != null) {
				that.vis.stop();
			}
			this.song.setTitle('■');
		}, false);

		audio.addEventListener('progress', function(e) {
			var j = this.buffered.length;
			if (j < 1) {
				return;
			}
			var max = 0;
			for (var i = 0; i < j; i++) {
				var end = this.buffered.end(i);
				if (end > max) {
					max = end;
				}
			}
			this.track.bufferBar.style.width = percent(end, this.duration);
		}, false);

		/*
		audio.addEventListener('readystatechange', function(e) {
			console.log('readystatechange ' + this.readyState);
			if (this.readyState < this.HAVE_ENOUGH_DATA && !this.paused) {
				this.song.classList.add('loading');
			} else {
				this.song.classList.remove('loading');
			}
		}, false);
		*/

		audio.addEventListener('canplay', function(e) {
			this.song.classList.remove('loading');
		}, false);

		audio.hide    = function() { this.track.classList.remove('active'); };
		audio.disable = function() { this.track.classList.add('inactive'); };
		audio.enable  = function() { this.track.classList.remove('active'); };
	},

	hookSong: function(song) {
		var that = this;

		song.audio = song.querySelector('audio');
		song.totalTime = song.querySelector('.total-time');
		song.currentTime = song.querySelector('.current-time');
		song.deleteButton = song.querySelector('.delete-song');

		var setDuration = function() {
			song.totalTime.textContent = song.totalTime.innerText = formatDuration(this.duration);
		};

		song.audio.addEventListener('durationchange', setDuration, false);
		song.audio.addEventListener('loadedmetadata', setDuration, false);
		if (song.audio.readyState >= HTMLAudioElement.HAVE_METADATA) {
			setDuration.call(song.audio);
		}

		song.audio.song = song;

		Pls.hookAudio(song.audio);

		song.a = song.querySelector('a');

		song.stop = function() {
			this.audio.pause();
		};

		song.disable = function() {
			this.audio.track.classList.add('inactive');
			this.audio.track.classList.remove('active');
			this.classList.remove('active');
		};

		song.play = function(time) {
			if (this.buffered == null || this.buffered.length == 0) {
				this.classList.add('loading');
				this.audio.track.classList.add('active');
			}

			if (that.currentSong != null) {
				that.currentSong.stop();
				that.currentSong.disable();
			}

			if (history.state == null || history.state.id != this.dataset.id) {
				var href = this.a.getAttribute('href');
				if (window.location.hash != "") {
					href += window.location.hash;
				}
				var state = { "id": this.dataset.id };
				var title = this.a.getAttribute('title');
				history.pushState(state, title, href);
			}

			that.currentSong = this;
			this.classList.add('active');

			if (that.haveAudioAPI) {
				if (this.mediaSource == null) {
					this.mediaSource = that.ctx.createMediaElementSource(this.audio);
				}
				this.mediaSource.connect(that.analyser);
			}

			this.audio.muted = false;

			if (time != null) {
				var f = function() {
					this.currentTime = time;
					this.play();
					this.removeEventListener('canplay', f);
				};
				this.audio.addEventListener('canplay', f, false);

				if (this.audio.readyState >= this.audio.HAVE_ENOUGH_DATA) {
					this.audio.currentTime = time;
					this.audio.removeEventListener('canplay', f);
					this.audio.play();
				}
			} else {
				this.audio.play();
			}
			that.ctx.resume();
		};

		song.toggle = function() {
			if (!this.audio.paused) {
				this.stop();
			} else {
				if (this.audio.readyState == HTMLMediaElement.HAVE_NOTHING) {
					this.audio.load();
				}
				this.play();
			}
		};

		song.prev = function() {
			var prevSong = this.previousElementSibling;
			if (prevSong != null) {
				prevSong.play();
			}
		};

		song.next = function() {
			var nextSong = this.nextElementSibling;
			if (nextSong != null) {
				nextSong.play();
			}
		};

		song.scrollTo = function() {
			// TODO: animate it?
			var y = this.offsetTop;
			scroll(0, y - $('header').offsetHeight);
		};

		song.scrollToBottom = function() {
			var y = this.offsetTop - window.innerHeight +
				this.offsetHeight + $('header').offsetHeight;
			scroll(0, y);
		};

		song.remove = function() {
			if (!confirm('Really delete \'' + song.a.getAttribute('title') + '\'?')) {
				return;
			}

			var x = new XMLHttpRequest();

			x.addEventListener('load', function() {
				if (this.status !== 204) {
					var err = JSON.parse(this.responseText);
					that.showMessage($('#upload'), err.Error, 'bad');
				} else {
					song.addEventListener('transitionend', function() {
						this.parentElement.removeChild(this);
					}, false);
					song.classList.add('fresh');
					var trackCount = $('#track-count');
					trackCount.innerText = trackCount.textContent = parseInt(trackCount.textContent || trackCount.innerText) - 1;
				}
			}, false);

			x.open('DELETE', '/file/' + this.dataset.id, true);
			x.send();
		};

		song.setTitle = function(text) {
			var h2 = this.a.querySelector('h2');
			text = text + '\uFE0E ' + (h2.innerText || h2.textContent);
			var title = $('title');
			title.innerText = title.textContent = text;
		};


		/*
		song.a.addEventListener('touchstart', function() {
			e.stopPropagation();
			e.preventDefault();
		}, false);
	   */

		song.a.addEventListener('touchend', function(e) {
			throw e;
			if (song.dragged) {
				song.dragged = false;
				return;
			}
			e.stopPropagation();
			e.preventDefault();
			song.toggle();
		}, false);

		song.a.addEventListener('dragend', function(e) {
			song.dragged = true;
		}, false);

		song.a.addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			song.toggle();
		}, false);

		song.deleteButton.addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			song.remove();
		}, false);
	},

	hookFollower: function(follower) {
		follower.addEventListener('transitionend', function(e) {
			if (!e.target.classList.contains('active')) {
				e.target.style.display = 'none';
				this.loader.reset();
			}
		}.bind(this));

		follower.show = function() {
			this.style.display = 'block';
			this.classList.add('active');
		};
		follower.hide = function() {
			this.classList.remove('active');
		};
		follower.setPosEvent = function(e) {
			this.setPos(e.clientX, e.clientY);
		};
		follower.setPos = function(x, y) {
			this.style.left = (x - this.offsetWidth/2) + 'px';
			this.style.top = (y - this.offsetHeight/2) + 'px';
		};

		this.loader = $('#loader');
		this.loader.bar = $('#loader-bar');
		this.loader.RADIUS = 96;
		this.loader.PATH_TEMPLATE = 'M' + (this.loader.RADIUS+4) + ' 4 a ' +
			this.loader.RADIUS + ' ' + this.loader.RADIUS + ' 0 ';

		this.loader.setProgress = function(progress) {
			var theta;
			if (progress == 1) {
				theta = 2*Math.PI - 0.01;
			} else {
				theta = 2*Math.PI * progress;
			}
			var x = Math.sin(theta) * this.RADIUS;
			var y = -(Math.cos(theta) * this.RADIUS) + this.RADIUS;
			var big = (theta >= Math.PI ? '1' : '0');
			var d = this.PATH_TEMPLATE + big + ' 1 ' + x + ' ' + y;
			if (progress == 1) {
				d += ' Z';
			}
			this.bar.setAttribute('d', d);
		};

		this.loader.reset = function() {
			this.bar.setAttribute('d', '');
		};
	},

	getTrackList: function(cb) {
		json('/tracks.json', cb);
	},

	insertTrack: function(id, parent) {
		xhr(`/track/${id}.html`, null, function(x) {
			
		});
	},

	merge: function(tracks) {
		diff(
			Array.prototype.slice.call($$('li.songs')),
			tracks,
			function(song, track) {
				return song.dataset.id == track.id;
			},
			function(track) {

			},
			function(song) {

			}
		);
	}
};
