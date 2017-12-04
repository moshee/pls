function Visual(elem, analyser, stopSpeed, numBars) {
	this.elem = elem;
	this.mode = Visual.STOPPED;
	this.stopSpeed = stopSpeed;

	this.analyser = analyser;
	this.analyser.maxDecibels = -15;
	this.numBars = numBars;
	this.analyser.fftSize = this.numBars * 2;
	var len = this.analyser.frequencyBinCount;
	this.freqs = new Uint8Array(len);
	this.barWidth = this.elem.width / len;

	this.ctx = this.elem.getContext('2d');
	this.ctx.fillStyle = this.ctx.strokeStyle = '#f00b42';
	this.ctx.lineWidth = 2;

	this.scaleCanvas(this.ctx);

	this.samples = new Uint8Array(this.elem.width);
	this.scaleFactors = new Float32Array(this.elem.width);
	for (var i = 0, l = this.scaleFactors.length; i < l; i++) {
		this.scaleFactors[i] = Math.sin(Math.PI * i / l);
	}

	this.buf = new CircularBuffer(this.elem.width / 2);
	for (var i = 0; i < this.buf.arr.length; i++) {
		this.buf.arr[i] = new Uint8Array(this.elem.height);
	}

	this.currentStyle = parseInt(window.cookies['style'] || 0);

	var that = this;

	this.elem.addEventListener('click', function(e) {
		that.currentStyle = (that.currentStyle + 1) % Visual.styles.length;
		document.cookie = 'style=' + that.currentStyle;
	}, false);
}

Visual.prototype.scaleCanvas = function(ctx) {
	var devicePixelRatio = window.devicePixelRatio || 1;
	var width = ctx.canvas.clientWidth * devicePixelRatio;
	var height = ctx.canvas.clientHeight * devicePixelRatio;
	if (width !== ctx.canvas.width || height !== ctx.canvas.height) {
		ctx.canvas.width = width;
		ctx.canvas.height = height;
		ctx.scale(0, 0, ctx.canvas.width, ctx.canvas.height);
	}
};


Visual.STOPPED  = 0;
Visual.STOPPING = 1;
Visual.RUNNING  = 2;
Visual.INIT     = 3;

Visual.prototype.start = function() {
	if (this.mode == Visual.STOPPED) {
		this.mode = Visual.RUNNING;
		requestAnimationFrame(this.draw.bind(this));
	} else {
		this.mode = Visual.RUNNING;
	}
};

Visual.prototype.stop = function() {
	this.mode = Visual.STOPPING;
};

Visual.prototype.draw = function() {
	var t = Visual.styles[this.currentStyle].call(this);
	//if (t == null) {
		requestAnimationFrame(this.draw.bind(this));
	//} else {
		//setTimeout(this.draw.bind(this), t);
	//}
};

Visual.styles = [
	function() {
		this.analyser.fftSize = this.numBars * 2;
		this.ctx.fillStyle = '#f00b42';

		switch (this.mode) {
		case Visual.RUNNING:
			this.analyser.getByteFrequencyData(this.freqs);
			break;

		case Visual.STOPPING:
			var gotOne = false;

			for (var i = 0; i < this.freqs.length; i++) {
				if (this.freqs[i] > 0) {
					gotOne = true;
					if (this.freqs[i] >= this.stopSpeed) {
						this.freqs[i] -= this.stopSpeed;
					} else {
						this.freqs[i] = 0;
					}
				}
			}

			if (gotOne) {
				break;
			}
			this.mode = Visual.STOPPED;

		case Visual.STOPPED:
			this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
			return;
		}

		this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
		var h = this.elem.height;
		var x, dy, y1;
		var y = h / 2;

		for (var i = 0; i < this.freqs.length; i++) {
			x = i * this.barWidth;
			dy = (this.freqs[i]/255) * h;
			y1 = y - dy/2;

			this.ctx.fillRect(x, y1, this.barWidth - 1, dy);
		}
	},

	function() {
		this.analyser.fftSize = this.elem.width;

		switch (this.mode) {
		case Visual.RUNNING:
			this.analyser.getByteTimeDomainData(this.samples);
			break;

		case Visual.STOPPING:
			this.mode = Visual.STOPPED;

		case Visual.STOPPED:
			this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
			this.ctx.beginPath();
			this.ctx.moveTo(0, this.elem.height/2);
			this.ctx.lineTo(this.elem.width, this.elem.height/2);
			this.ctx.stroke();
			return;
		}

		this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
		this.ctx.beginPath();
		var h = this.elem.height;
		var x, y;

		for (var i = 0; i < this.samples.length; i++) {
			x = i;
			y = (this.samples[i] / 255);
			y -= 0.5;
			y *= this.scaleFactors[i];
			y += 0.5;
			y *= h;

			if (i == 0) {
				this.ctx.moveTo(x, y);
			} else {
				this.ctx.lineTo(x, y);
			}
		}

		this.ctx.stroke();
	},

	function() {
		this.analyser.fftSize = this.elem.height * 2;

		switch (this.mode) {
		case Visual.RUNNING:
			this.analyser.getByteFrequencyData(this.buf.arr[this.buf.i]);
			this.buf.advance();
			break;

		case Visual.STOPPING:
			this.mode = Visual.STOPPED;

		case Visual.STOPPED:
			return;
		}

		this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
		var y, z;

		this.buf.each(function(row, i) {
			if (row == null) {
				return;
			}
			for (var j = 0; j < row.length; j++) {
				y = this.elem.height - j;
				z = 'rgba(240, 11, 66, ' + (this.scaleFactors[i]*row[j]/255) + ')'

				this.ctx.fillStyle = z;
				this.ctx.fillRect(i, y, 1, 1);
				this.ctx.fillRect(this.elem.width - i - 1, y, 1, 1);
			}
		}.bind(this));
	}
];

function CircularBuffer(size) {
	if (size == 0) {
		throw new Error('CircularBuffer: cannot create empty buffer');
	}
	this.arr = new Array(size);
	this.i = 0;
}

CircularBuffer.prototype.advance = function() {
	this.i = (this.i + 1) % this.arr.length;
	return this.i;
};

CircularBuffer.prototype.add = function(elem) {
	this.arr[this.advance()] = elem;
};

CircularBuffer.prototype.each = function(f) {
	for (var i = 0; i < this.arr.length; i++) {
		f(this.arr[this.i], i);
		this.advance();
	}
};
