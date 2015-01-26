var TRIGGER = 50,
	VELOCITY = 15,
	EASING_TIME = 250,
	PAGE_BUFFER = 50;

PageSlider = function(el, opts) {

	var _this = this;
		
	this.el = $(el);
	this.downArrow = el.find('.down.ps-arrow')
	this.upArrow = el.find('.up.ps-arrow')
	this.leftArrow = el.find('.left.ps-arrow')
	this.rightArrow = el.find('.right.ps-arrow')
	this.conveyor = this.el.children('#ps-conveyor');
	this.width = $(window).width();
	this.height = $(window).height();
	this.top = 0;
	this.left = 0;
	this.dragged = {
		top: 0,
		left: 0
	};
	this.bounds = {
		top: 0,
		left: 0,
		bottom: 0,
		right: 0
	};
	this.pages = [];
	this.pageInd = opts.pageInd || 0;
	this.layoutTemplate = Template[opts.layoutTemplate];
	this.opts = opts;

	opts.layout && _.each(opts.layout, function(subPageCount, ind) {
		var thisPage = new Page({ps: _this, ind: ind, subPageCount: subPageCount});
		_this.conveyor.append(thisPage.container);
		_this.pages.push(thisPage);
	});
	opts.seedTemplates && _.each(opts.seedTemplates, function(tempArray, ind) {
		_.each(tempArray, function(temp, subInd) {
			var data;
			if (opts.seedData) {
				if (opts.seedData.length) {
					data = opts.seedData[ind][subInd];
				}
				else {
					data = opts.seedData;
				}
			}
			_this.renderTo([ind, subInd], temp, data)
		});
	});
	this.pageCount = opts.layout && opts.layout.length;

	this.reposition(0);

	this.publicObj = function() {
		return {
			renderTo: _this.renderTo.bind(_this),
			transitionTo: _this.transitionTo.bind(_this),
			forward: _this.forward.bind(_this),
			back: _this.back.bind(_this),
			up: _this.up.bind(_this),
			down: _this.down.bind(_this),
			go: _this.go.bind(_this),
			getLocation: _this.getLocation.bind(_this),
			page: _this.page.bind(_this),
			getPageInd: _this.getPageInd.bind(_this),
			subPage: _this.subPage.bind(_this),
			getSubPageInd: _this.getSubPageInd.bind(_this),
			setMoveable: _this.setMoveable.bind(_this),
			current: function() {
				return _this;
			},
			getPage: function(page) {
				return _this.pages[page];
			},
			getSubPage: function(location, extraArg) {
				if (extraArg) location = [location, extraArg];
				var page = _this.pages[location[0]];
				return page && page.subPages[location[1]];
			}
		}
	}

};

PageSlider.prototype.renderTo = function(location, template, data) {
	var page = (location instanceof Array) ? location[0] : location;
	this.pages[page].renderTo(location[1], template, data);
}

PageSlider.prototype.transitionTo = function(location, template, data, waitOn) {
	patchRendered(template, this.waitThenGo.bind(this, location, waitOn));
	this.renderTo.apply(this, arguments);
}

PageSlider.prototype.reposition = function(immediate, cb) {
	if (typeof immediate === 'function') {
		cb = immediate;
		immediate = false;
	}
	var newLeft = -this.width * this.pageInd,
		_this = this,
		page = this.page(),
		moved = false;

	if (newLeft !== this.left) moved = true;

	if (newLeft !== this.left || this.dragged.left !== this.left) {
		this.left = newLeft;
		this.dragged.left = this.left;
		this.conveyor.snabbt({
			position: [this.left, this.top, 0],
			duration: immediate ? immediate : 1000,
			easing: 'ease',
			callback: function() {
				_this.pages[_this.pageInd].reposition(immediate, cb, moved);
			}
		});
	} else {
		_this.pages[this.pageInd].reposition(immediate, cb, moved);
	}

	if ((this.loop || this.pageInd < this.pageCount - 1) && page.moveable.right) {
		this.rightArrow.removeClass('disabled');
		this.bounds.right = this.left - this.width;
	}
	else {
		this.rightArrow.addClass('disabled');
		this.bounds.right = this.left - PAGE_BUFFER;
	}

	if ((this.loop || this.pageInd > 0) && page.moveable.left)  {
		this.leftArrow.removeClass('disabled');
		this.bounds.left = this.left + this.width;
	}
	else { 
		this.leftArrow.addClass('disabled');
		this.bounds.left = this.left + PAGE_BUFFER;
	}
}

PageSlider.prototype.realign = function(immediate) {
	this.pageInd = Math.min(Math.max(-Math.round(this.dragged.left / this.width), 0), this.pageCount - 1);
	this.reposition(immediate);
}

PageSlider.prototype.forward = function(loop) {
	this.pageInd++;
	if (this.pageInd >= this.pageCount) {
		if (loop) this.pageInd = 0;
		else this.pageInd = this.pageCount - 1;
	}
	this.reposition();
}

PageSlider.prototype.back = function(loop) {
	this.pageInd--;
	if (this.pageInd < 0) {
		if (loop) this.pageInd = this.pageCount - 1;
		else this.pageInd = 0;
	}
	this.reposition();
}

PageSlider.prototype.down = function(loop) {
	this.page() && this.page().down(loop);
}

PageSlider.prototype.up = function(loop) {
	this.page() && this.page().up(loop);
}

PageSlider.prototype.go = function(location, immediate) {
	var pageInd = location[0],
		subPageInd = location[1],
		newPage = this.pages[pageInd];
	if (newPage) this.pageInd = pageInd;

	var newSubPage = newPage.subPages[subPageInd];
	if (newSubPage) newPage.subPageInd = subPageInd;

	this.reposition(immediate);
}

PageSlider.prototype.nudge = function(location) {
	if (location[0] > this.pageInd) this.dragged.left = this.left - PAGE_BUFFER;
	else if (location[0] < this.pageInd) this.dragged.left = this.left + PAGE_BUFFER;
	else {
		this.page().nudge(location);
		return null;
	}

	this.conveyor.snabbt({
		position: [this.dragged.left, this.dragged.top, 0],
		duration: EASING_TIME,
		easing: 'easeOut'
	});
}

PageSlider.prototype.waitThenGo = function(location, waitOn) {
	var _this = this;
	if (!waitOn) {
		this.go.call(this, location);
		return location;
	}
	else if (!(waitOn instanceof Array)) waitOn = [waitOn];

	this.nudge(location);
	Tracker.autorun(function(c) {
		ready = _.reduce(waitOn, function(readySoFar, thisWait) {
			return readySoFar && thisWait.ready && thisWait.ready();
		}, true);
		if (ready) {
			c.stop();
			_this.go.call(_this, location);
		}
	});
}

PageSlider.prototype.getLocation = function(modifier) {
	var pageInd = this.pageInd,
		subPageInd;

	if (modifier === 'page') return pageInd;

	subPageInd = this.pages[pageInd].subPageInd;

	if (modifier === 'subPage') return subPageInd;
	else return [pageInd, subPageInd];
}

PageSlider.prototype.page = function() {
	return this.pages[this.pageInd];
}

PageSlider.prototype.getPageInd = function() {
	return this.pageInd;
}

PageSlider.prototype.subPage = function() {
	return this.page().subPage();
}

PageSlider.prototype.getSubPageInd = function() {
	return this.page().subPageInd;
}

PageSlider.prototype.setMoveable = function(dir, bool) {
	if (typeof dir === 'boolean') {
		this.page().setMoveable(bool);
		this.subPage().setMoveable(bool);
	} else if (dir === 'left' || dir === 'right') {
		this.page().setMoveable(dir, bool);
	} else if (dir === 'up' || dir === 'down') {
		this.subPage().setMoveable(dir, bool);;
	}
}

PageSlider.prototype.resize = function() {
	this.width = $(window).width();
	this.height = $(window).height();
	this.reposition();
}

Page = function(opts) {

	var _this = this;

	this.ps = opts.ps;
	this.ind = opts.ind;
	this.container = $('<div class="ps-page"></div>');
	this.subPages = [];
	this.subPageCount = opts.subPageCount;
	this.subPageInd = opts.subPageInd || 0;
	this.top = 0;
	this.left = 0;
	this.dragged = {
		top: 0,
		left: 0
	};
	this.moveable = {
		left: true,
		right: true
	};
	this.position();

	for (var i = 0; i < opts.subPageCount; i++) {
		var thisSubPage = new SubPage({ps: _this.ps, page: _this, subInd: i});
		this.container.append(thisSubPage.container);
		_this.subPages.push(thisSubPage);
	}

};

Page.prototype.position = function() {
	this.container.css('left', 100 * this.ind + '%');	
}

Page.prototype.renderTo = function(location, template, data) {
	var subPage = location || 0;
	this.subPages[subPage].render(template, data);
}

Page.prototype.reposition = function(immediate, cb, moved) {
	if (typeof immediate === 'function') {
		cb = immediate;
		immediate = false;
	}
	var _this = this,
		ps = this.ps,
		newTop = -ps.height * this.subPageInd,
		subPage = this.subPage(),
		wrappedCb = function() {
			moved && _this.subPage().onTransitioned && _this.subPage().onTransitioned();
			cb && cb();
		};

	if (newTop !== this.top) moved = true;

	if (newTop !== this.top || this.dragged.top !== this.top) {
		this.top = newTop;
		this.dragged.top = this.top;
		this.container.snabbt({
			position: [this.left, this.top, 0],
			duration: immediate ? immediate : 1000,
			easing: 'ease',
			callback: wrappedCb
		});
	} else {
		wrappedCb();
	}
	if ((this.loop || this.subPageInd < this.subPageCount - 1) && subPage.moveable.down) { 
		ps.downArrow.removeClass('disabled');
		ps.bounds.top = this.top - ps.height;
	}
	else {
		ps.downArrow.addClass('disabled');
		ps.bounds.top = this.top - PAGE_BUFFER;
	}
	if ((this.loop || this.subPageInd > 0) && subPage.moveable.up) {
		ps.upArrow.removeClass('disabled');
		ps.bounds.bottom = this.top + ps.height;
	}
	else { 
		ps.upArrow.addClass('disabled');
		ps.bounds.bottom = this.top + PAGE_BUFFER;
	}
}

Page.prototype.realign = function(immediate) {
	this.subPageInd = Math.min(Math.max(-Math.round(this.dragged.top / this.ps.height), 0), this.subPageCount - 1);
	this.reposition(immediate);
}

Page.prototype.down = function(loop) {
	this.subPageInd++;
	if (this.subPageInd >= this.subPageCount) {
		if (loop) this.subPageInd = 0;
		else this.subPageInd = this.subPageCount - 1;
	}
	this.reposition();
}

Page.prototype.up = function(loop) {
	this.subPageInd--;
	if (this.subPageInd < 0) {
		if (loop) this.subPageInd = this.subPageCount - 1;
		else this.subPageInd = 0;
	}
	this.reposition();
}

Page.prototype.nudge = function(location) {
	if (location[1] > this.subPageInd) this.dragged.top = this.top + PAGE_BUFFER;
	else if (location[1] < this.subPageInd) this.dragged.top = this.top - PAGE_BUFFER;
	else return null;

	this.container.snabbt({
		position: [this.dragged.left, this.dragged.top, 0],
		duration: EASING_TIME,
		easing: 'easeOut'
	});
}

Page.prototype.setTo = function(subPage) {
	this.subPage = subPage;
	this.reposition();
}

Page.prototype.subPage = function() {
	return this.subPages[this.subPageInd];
}

Page.prototype.getSubPageInd = function() {
	return this.subPageInd;
}

Page.prototype.setMoveable = function(dir, bool) {
	if (typeof dir === 'boolean') {
		this.moveable = {
			left: bool,
			right: bool
		};
	} else if (dir === 'right' || dir === 'left') {
		this.moveable[dir] = bool;
	}
	this.ps.reposition(0);
}

SubPage = function(opts) {

	this.ps = opts.ps;
	this.page = opts.page;
	this.ind = this.page.ind;
	this.subInd = opts.subInd;
	this.moveable = {
		up: true,
		down: true
	};
	this.container = $('<div class="ps-subpage"></div>');
	this.position();
};

SubPage.prototype.position = function() {
	this.container.css('top', 100 * this.subInd + '%');
}

SubPage.prototype.render = function(template, data) {
	if (this.view) Blaze.remove(this.view);
	this.container.empty();

	var thisTemplate = (typeof template === 'string') ? Template[template] : template;
	if (!(thisTemplate instanceof Blaze.Template)) {
		console.error('Cannot render a non-template: ' + (template ? template.toString() : template));
		console.trace();
		return false;
	}

	if (this.ps.layoutTemplate) {
		data = {
			data: data,
			template: template
		};
		thisTemplate = this.ps.layoutTemplate
	}

	if (data && !_.isEmpty(data))
		Blaze.renderWithData(thisTemplate, data, this.container[0]);
	else
		Blaze.render(thisTemplate, this.container[0]);		
}

SubPage.prototype.setMoveable = function(dir, bool) {
	if (typeof dir === 'boolean') {
		this.moveable = {
			up: bool,
			down: bool
		};
	} else if (dir === 'up' || dir === 'down') {
		this.moveable[dir] = bool;
	}
	this.page.reposition(0);
}

// **********************************

Template.pageSlider.events({
	'touchablemove #page-slider': function (evt, tp, touchable) {
		var ps = tp.ps,
			page = tp.ps.pages[tp.ps.pageInd];
		if (!tp.dragging) {
			if (distance(touchable.currentStartDelta) > TRIGGER) {
				tp.dragging = largerMag(touchable.currentStartDelta);
			}			
		} else if (tp.dragging === 'x') {
			ps.dragged.left = bound(ps.left + touchable.currentStartDelta.x, ps.bounds.left, ps.bounds.right);
			ps.conveyor.snabbt({
				position: [ps.dragged.left, ps.dragged.top, 0],
				duration: 50,
				easing: 'linear'
			});
		} else if (tp.dragging === 'y') {
			page.dragged.top = bound(page.top + touchable.currentStartDelta.y, ps.bounds.bottom, ps.bounds.top);
			page.container.snabbt({
				position: [page.dragged.left, page.dragged.top, 0],
				duration: 50,
				easing: 'linear'
			});
		}
	},
	'touchableend #page-slider': function (evt, tp, touchable) {
		if (!tp.dragging) return;
		var ps = tp.ps,
			page = tp.ps.pages[tp.ps.pageInd];
		if (tp.dragging === 'x') {
			ps.dragged.left = bound(ps.left + touchable.currentStartDelta.x, ps.bounds.left, ps.bounds.right) + bound(touchable.currentDelta.x * VELOCITY, PAGE_BUFFER, -PAGE_BUFFER);
			tp.ps.conveyor.snabbt({
				position: [ps.dragged.left, ps.dragged.top, 0],
				duration: EASING_TIME,
				easing: 'easeOut'
			});
			Meteor.setTimeout(ps.realign.bind(ps, EASING_TIME), EASING_TIME/2.5);
		} else if (tp.dragging === 'y') {
			page.dragged.top = bound(page.top + touchable.currentStartDelta.y, ps.bounds.bottom, ps.bounds.top) + bound(touchable.currentDelta.y * VELOCITY, PAGE_BUFFER, -PAGE_BUFFER);
			page.container.snabbt({
				position: [page.dragged.left, page.dragged.top, 0],
				duration: EASING_TIME,
				easing: 'easeOut'
			});
			Meteor.setTimeout(page.realign.bind(page, EASING_TIME), EASING_TIME/2.5);	
		}
		tp.dragging = false;
	},
	'click .down.ps-arrow': function(evt, tp) {
		tp.ps.page().down();
	},
	'click .up.ps-arrow': function(evt, tp) {
		tp.ps.page().up();
	},
	'click .left.ps-arrow': function(evt, tp) {
		tp.ps.back();
	},
	'click .right.ps-arrow': function(evt, tp) {
		tp.ps.forward();
	}
});

Template.pageSlider.created = function() {
	this.dragging = false;
}

Template.pageSlider.rendered = function() {

	var opts = (this.data && this.data.options) || {},
		$el = this.$('#page-slider');

	this.ps = new PageSlider($el, opts);
	Meteor.PageSlider = this.ps.publicObj();
	$el.Touchable();

	$(window).on('resize', this.ps.resize.bind(this.ps));

}

function patchRendered(template, cb) {

	var thisTemplate = (typeof template === 'string') ? Template[template] : template;
	if (!(thisTemplate instanceof Blaze.Template)) throw new Meteor.Error('bad_template', 'Cannot render a non-template', template);

	if (!thisTemplate) throw new Meteor.Error('bad_template', 'No template called ' + template + '; cannot patch.');

	var oldRendered = thisTemplate.rendered;
	thisTemplate.rendered = function() {		
		oldRendered && oldRendered.apply(this, arguments);
		thisTemplate.rendered = oldRendered;
		cb && cb.apply(this, arguments);
	}

}

function distance(vector) {
	return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
}

function largerMag(vector) {
	return Math.abs(vector.x) > Math.abs(vector.y) ? 'x' : 'y';
}

function bound(value, max, min) {
	return Math.max(Math.min(value, max), min);
}