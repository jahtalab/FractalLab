/**
 * Fractal Lab
 * Last update: 26 Feb 2011
 * 
 * Changelog:
 *   0.1   - Initial release
 * 
 * 
 * Copyright (c) 2011 Tom Beddard
 * http://www.subblue.com
 * 
 * Licensed under the GPL Version 3 license.
 * http://www.gnu.org/licenses/
 */

/*global window, $, document, GLQuad, console, Camera, FPS, SuperSlider, Color*/

function FractalLab(ui, opts) {
	var self = this,
		defaultOpts = {
			canvas: null,
			vertex: null,
			fragment: null,
			width: 400,
			height: 300,
			preview_width: 400,
			vertex_path: null,
			fragment_path: null,
			framerate: null,
			color_picker: null,
			ready_callback: null,
			fps: 60,
			thumbnail_size: 128,
			mode: '3d'
		},
		initialised = false;
	
	this.options = $.extend({}, defaultOpts, opts);
	this.quad = new GLQuad(this.options);
	this.gl_quad = this.quad.data("GLQuad");
	this.ui = $(ui);
	this.tick = 0;
	this.preview_mode = true;
	this.keymove = false;
	this.changed = false;
	this.editing_code = false;
	this.pause_auto_update = false;
	this.keystates = {};
	this.impulse = {};
}



FractalLab.prototype = {
	init: function () {
		var self = this;
		
		this.cameraUniform = 'cameraPosition';
		this.objRotationUniform = 'objectRotation';
		this.moveMultiplier = 1;
		
		this.init_ui();
		
		if (!this.initialized) {
			this.init_events();
		}
		
		$("#vertex_code").val(this.gl_quad.options.vertex.replace(/\t/g, "    "));
		$("#fragment_code").val(this.gl_quad.options.fragment.replace(/\t/g, "    "));
		
		// Little hack
		window.setTimeout(function () {
			$("#compile").removeClass("enabled");
		}, 100);
		
		this.resize();
		
		if (!this.initialized && this.options.ready_callback) {
			this.options.ready_callback();
		}
		
		this.initialized = true;
	},
	
	
	init_ui: function () {
		// Setup UI
		$("#group_tabs, .group").remove();
		this.group_tabs = null;
		
		this.addControls();
		this.setControlVisibility();
	
		// Camera control
		if (this.gl_quad.parameters[this.cameraUniform]) {
			if (typeof(this.gl_quad.parameters.cameraPitch) !== 'undefined') {
				this.options.mode = '3d';
				this.camera = new Camera(this.gl_quad.parameters[this.cameraUniform][0],
										 this.gl_quad.parameters[this.cameraUniform][1],
										 this.gl_quad.parameters[this.cameraUniform][2],
										 this.gl_quad.parameters.cameraPitch,
										 this.gl_quad.parameters.cameraYaw);	
			} else {
				this.options.mode = '2d';
				this.camera = new Camera(this.gl_quad.parameters[this.cameraUniform][0],
										 this.gl_quad.parameters[this.cameraUniform][1],
										 this.gl_quad.parameters[this.cameraUniform][2],
										 0,
										 0);
			}
			
			this.camera.step(0.001);
		}
	},
	
	
	init_events: function () {
		var self = this;
		
		// Events
		this.keyEvents();
		
		this.mouseDownListener = function (event) {
			if (!self.editing_code) {
				$(event.target).addClass("moving");
				self.mouseDown(event);
			}
		};
	
		this.mouseOverListener = function (event) {
			self.keymove = self.editing_code ? false : true;
		};
		
		this.mouseOutListener = function (event) {
			self.keymove = false;
			$(event.target).removeClass("moving");
		};
		
		this.mouseMoveListener = function (event) {
			if (!self.editing_code) {
				self.mouseMove(event);
			}
		};
	
		this.mouseUpListener = function (event) {
			self.mouseUp(event);
			$(event.target).removeClass("moving");
		};
		
		this.mouseWheel = function (event) {
			if (self.keymove) {
				// event.preventDefault();
				
				var delta = event.wheelDelta || event.detail;
				
				if (delta > 0) {
					self.impulse.forward = true;		// Zoom in
				} else if (delta < 0) {
					self.impulse.backward = true;		// Zoom out
				}	
			}
		};
		
		$(window).resize(function () {
			window.clearTimeout(self.resizeTimeout);
			self.resizeTimeout = window.setTimeout(function () {
				self.resize();
			}, 200);
		});
		
		// jQuery events caused triggering delays here
		this.gl_quad.canvas
		  .parent().get(0).addEventListener("mousedown", this.mouseDownListener, false);
		this.gl_quad.canvas
		  .parent().get(0).addEventListener("mouseover", this.mouseOverListener, false);
		this.gl_quad.canvas
		  .parent().get(0).addEventListener("mouseout",  this.mouseOutListener,  false);
		
		window.addEventListener('DOMMouseScroll', this.mouseWheel, false);
		window.addEventListener('mousewheel', this.mouseWheel, false);
		
		this.gl_quad.canvas.parent().bind("selectstart", function () {
			return false;
		});
		
		// View mode
		$("#mode").change(function () {
			self.mode = this.value;
			self.changed = true;
			self.pause_auto_update = false;
			$(this).blur();
			self.mouseUp();
			self.resize();
		});
		
		this.mode = $("#mode").val();
		
		if (this.options.framerate) {
			this.framerate = $(this.options.framerate);
			this.fps = new FPS(60);
		}
	},
	
	
	fullscreen: function (reset) {
		var canvas = $("#stage").detach();

		if ($("body").hasClass("fullscreen") || reset) {
			$("body").removeClass("fullscreen");
			$("#help").after(canvas);
		} else {	
			$("body").addClass("fullscreen")
			$("body").append(canvas);
		}

		if ($("#library:visible").length > 0) {
			$("#library_button").trigger("click");
		}
		
		this.resize();
		this.changed = true;
	},
	
	
	// Resize canvas to fit the container element
	resize: function (event, resolution,size) {
		var c = $(this.gl_quad.canvas),
			p = c.parent(),
			w = p.width(), 
			h = p.height(),
			a = w / h;
            
		if (resolution === 'render' &&  this.renderflies && this.renderflies.job) {
            var width = this.renderflies.job.width;
            var height = this.renderflies.job.height;
            p.hide();
            p.width(width);
            p.height(height);
            w = width;
            h = height;
            a = w/h;
                c.removeClass("fit");
			this.preview_mode = false;
		} else
        
		
		if (!resolution || resolution === 'preview') {
			// Preview res
			w = this.options.preview_width;
			h = Math.floor(w / a);
			c.addClass("fit");
			this.preview_mode = true;
		} else {
			// Full resolution
			c.removeClass("fit");
			this.preview_mode = false;
		}
		
		if (this.gl_quad.parameters.size) {
			this.gl_quad.parameters.size = [w, h];
		}
		
		if (this.gl_quad.parameters.outputSize) {
			this.gl_quad.parameters.outputSize = [p.width(), p.height()];
		}
		
		this.gl_quad.options.width = w;
		this.gl_quad.options.height = h;
		this.gl_quad.resize(w, h);
		this.gl_quad.draw();
		
		$("#resolution").text(w + "x" + h + " px");
		this.main();
	},
	
	
	// Load from the saved shader object
	load: function (shader) {
        //console.log(shader);
        //DEV//console.log(JSON.stringify({fragment:shader.fragment, vertex: shader.vertex}));
    
		$("#vertex_code").val(shader.vertex);
		$("#fragment_code").val(shader.fragment);
		
		for (var p in shader.params) {
			if (typeof(shader.params["_" + p]) !== 'undefined') {
				// replace rotation matrix with orignal vector
				shader.params[p] = shader.params["_" + p];
			}
		}
		
		this.gl_quad.reset();
		this.gl_quad.parameters = shader.params;
		this.default_params = this.gl_quad.parameters;
		this.stepSpeed = shader.params.stepSpeed;
		this.recompile();
	},
	
	
	// Load shaders from URLs
	load_by_path: function (vertex_path, fragment_path) {
		this.default_params = this.gl_quad.parameters;
		this.gl_quad.reset(true);
		this.gl_quad.loadShaders(vertex_path, fragment_path);
	},
	
	
	// Reset to default params
	reset_params: function () {
		this.gl_quad.parameters = this.default_params || this.gl_quad.parameters;
		this.recompile();
	},
	
	
	// Return shader object for saving
	params: function (title) {
		var height = Math.round(this.options.thumbnail_size * this.gl_quad.options.height / this.gl_quad.options.width),
			thumb = $("<canvas>").attr({width: this.options.thumbnail_size, height: height}).get(0),
			thumbContext = thumb.getContext("2d");
		
		thumbContext.drawImage(this.canvas(), 0, 0, this.options.thumbnail_size, height);
		
		return {
			title: title,
			vertex: $("#vertex_code").val(),
			fragment: $("#fragment_code").val(),
			thumbnail: thumb.toDataURL("image/png"),
			params: JSON.stringify(this.gl_quad.parameters)
		};
	},
	
	
	// Recompile the current shader and reset the controls
	recompile: function (event) {
		$("#log").text("");
		
		for (var p in this.gl_quad.parameters) {
			if (typeof(this.gl_quad.parameters["_" + p]) !== 'undefined') {
				// replace rotation matrix with orignal vector
				this.gl_quad.parameters[p] = this.gl_quad.parameters["_" + p];
			}
		}
		
		this.gl_quad.createProgram($("#vertex_code").val(), $("#fragment_code").val());
	},
	
	
	setControlVisibility: function () {
		for (var param in this.gl_quad.parameters) {
			if (this.gl_quad.getUniformLocation(param) || this.gl_quad.defines.vertex[param] || this.gl_quad.defines.fragment[param]) {
				$("#control_" + param).show();
			} else {
				$("#control_" + param).hide();
			}
		}
		
		$(".group").first().show();
		$("#group_tabs a").first().addClass("active");
	
		$("#group_tabs a").click(function () {
			$(".group").hide();
			$("#group_tabs a").removeClass("active");
			$(this).addClass("active");
			$("#group_" + $(this).text()).show();
		});
	},
	
	
	addControls: function () {
		var i, l, prop;
		
		this.ui.html('');
		
		if (!this.group_tabs) {
			this.group_tabs = $('<div id="group_tabs">');
			this.ui.append(this.group_tabs);
		}
		
		// Add constant controls
		if (this.gl_quad.defines.vertex) {
			for (prop in this.gl_quad.defines.vertex) {
				if (this.gl_quad.defines.vertex.hasOwnProperty(prop)) {
					this.addControl(this.gl_quad.defines.fragment[prop]);
				}
			}
		}
		
		if (this.gl_quad.defines.fragment) {
			for (prop in this.gl_quad.defines.fragment) {
				if (this.gl_quad.defines.fragment.hasOwnProperty(prop)) {
					this.addControl(this.gl_quad.defines.fragment[prop]);
				}
			}
		}
		
		// Loop over gl_quad.controls to maintain order of params and use this as a key
		// to the gl_quad.uniforms object
		for (i = 0, l = this.gl_quad.controls.length; i < l; i += 1) {
			this.addControl(this.gl_quad.uniforms[this.gl_quad.controls[i]]);
		}
		
		// Step size
		this.addControl({
			control: "range", 
			group: "Camera", 
			label: "Speed", 
			min: 0.01, 
			max: 1, 
			step: 0.01, 
			decimal_places: 2, 
			"default": (this.stepSpeed || 0.5), 
			name: "stepSpeed"
		});
		
		// Object rotation
		this.objRotationX = $("#" + this.objRotationUniform + "_0").data("superslider");
		this.objRotationY = $("#" + this.objRotationUniform + "_1").data("superslider");
	},
	
	
	addControl: function (params) {
		var j, m, p, opts, div, h3, group, group_name, in_group = false, current_value;
		
		// Create a UI element if there is a label for the uniform input
		if (params.label) {
			p = $("<p>").attr("id", "control_" + params.name);
			group_name = params.group || 'Constants';
			in_group = false;
			
			// Group label
			if (params.group_label) {
				h3 = $("<h3>").text(params.group_label);
				p.append(h3);
			}
			
			if (params.control === 'color') {
				// Colour picker
				this.createControl(p, params);
				in_group = true;
				
			} else if (typeof(params['default']) === 'object') {
				// Multi component input
				for (j = 0, m = params['default'].length; j < m; j += 1) {
					
					// Set default value or take from existing parameters if possible
					current_value = params['default'] && params['default'][j];
					
					if (typeof(this.gl_quad.parameters[params.name]) !== 'undefined') {
						current_value = this.gl_quad.parameters[params.name][j];
					}
					
					opts = {
						"name": params.name + "_" + j,
						"label": (typeof(params.label) === 'object' ? params.label[j] : params.label), 
						"min": params.min,
						"max": params.max,
						"step": params.step,
						"default": current_value,
						"control": params.control,
						"group_label": (j === 0 && params.group_label)
					};
					
					this.createControl(p, opts);
					in_group = true;
				}
			} else {
				// Single component input
				params['default'] = typeof(this.gl_quad.parameters[params.name]) !== 'undefined' ? this.gl_quad.parameters[params.name] : params['default'];
				
				params.control = params.control || params.type;
				this.createControl(p, params);
				in_group = true;
			}
			
			if (in_group && $("#group_" + group_name).length === 0) {
				group = $('<div id="group_' + group_name + '" class="group">');
				this.group_tabs.append($("<a>").addClass("tab").text(group_name));
				this.ui.append(group);
			}

			$("#group_" + group_name).append(p);
		}
		
	},
	

	createControl: function (container, options) {
		var slider,
			name = options.name.split("_"),
			self = this,
			control, label, input, h3, i, option, color, value;
		
		options.decimal_places = 4;
		options.control = options.control || "range";
		
		if (options.control.match(/vec|float|range|int|rotation*/)) {
			// Standard range slider
			control = new SuperSlider(options.name, options);
			container.append(control);
			
		} else if (options.control === 'camera') {
			// Assign the special camera control
			this.cameraUniform = name[0];
			options.hide_slider = true;
			options.min  = -100;
			options.max  = 100;
			options.step = 0.001;
			options.decimal_places = 6;
			control = new SuperSlider(options.name, options);
			container.append(control);
			
		} else if (options.control === 'input') {
			// Number input without slider
			options.hide_slider = true;
			control = new SuperSlider(options.name, options);
			container.append(control);
		
		} else if (options.control === 'color') {
			// Colour picker
			if ($("#" + options.name).length === 0) {
				
				if (typeof(this.gl_quad.parameters[options.name]) !== 'undefined') {
					color = new Color([this.gl_quad.parameters[options.name][0] * 255, this.gl_quad.parameters[options.name][1] * 255, this.gl_quad.parameters[options.name][2] * 255]);
					
				} else {
					color = new Color([options['default'][0] * 255, options['default'][1] * 255, options['default'][2] * 255]);
				}
				
				control = $("<label>")
					.addClass("color_selection")
					.text(options.label)
					.prepend(
						$("<span>")
							.attr("id", options.name)
							.addClass("color_swatch")
							.css("backgroundColor", "#" + color.hex())
							.click(function (event) {
								self.setColor(event);
							})
						);
				
				container.append(control);
			}
			
			
		} else if (options.control === 'select') {
			// Select menu
			container.append($("<label>").attr("for", options.name).text(options.label));
			control = $("<select>").attr("id", options.name);
			
			for (i = 0; i < options.options.length; i += 1) {
				option = $("<option>").attr("value", options.options[i]).text(options.options[i]);
				control.append(option);
			}
			
			control.val(options["default"]);
			container.append(control);
			
		} else if (options.control === 'bool') {
			// Boolean checkbox
			control = $("<input>").attr({type: "checkbox", id: options.name, value: options.value || options["default"]});
			container.append($("<label>")
				.attr("for", options.name)
				.text(options.label)
				.prepend(control));
			
			if (this.gl_quad.parameters[options.name] !== false && typeof(this.gl_quad.parameters[options.name]) !== 'undefined') {
				control.attr("checked", true);
			}
			
		} else if (options.control === 'sampler2D') {
			// Image source
			value = options.value || options['default'];
			
			if (typeof(this.gl_quad.parameters[options.name]) !== 'undefined') {
				value = this.gl_quad.parameters[options.name];
			}
			
			control = $("<input>")
							.attr({ type: "text", 
									id: options.name, 
									value: value})
							.addClass("image_source");
			
			container
				.append($("<label>")
					.attr("for", options.name)
					.text(options.label))
				.append(control)
				.append($("<a>")
					.attr({href: control.val(), target: '_blank'})
					.append($("<img>")
						.attr({src: control.val(), title: "Preview image in a new window"})
						.addClass("image_preview"))
					);
			
		}
		
		if (control) {
			// Control change event
			control.bind("change", function (event) {
				self.controlListener(event, name, options);
			});
		}
	},
	
	
	controlListener: function (event, name, options) {
		var i, l, mat, speed;
		
		if (options.constant) {
			// Requires recompile
			if (options.control === 'bool') {
				if (event.target.checked) {
					this.gl_quad.parameters[name[0]] = event.target.value;
					
				} else {
					this.gl_quad.parameters[name[0]] = false;
				}
				
			} else {
				this.gl_quad.parameters[name[0]] = event.target.val || event.target.value;
			}
			
			$("#compile").addClass("enabled");
			
		} else {
			// Dynamic uniform input
			if (name.length > 1) {
				// Multi-component parameter
				if (options.control === 'rotation') {
					mat = [];
					
					for (i = 0; i < 3; i += 1) {
						mat[i] = $("#" + name[0] + "_" + i).data("slider").value();
					}
					
					this.gl_quad.parameters["_" + name[0]] = mat;  // Store original rotations
					this.gl_quad.parameters[name[0]] = this.rotationMatrix(mat);
					
				} else {
					this.gl_quad.parameters[name[0]][parseFloat(name[1])] = event.target.val;
				}
				
			} else {
				// Single parameter
				if (options.control === 'bool') {
					if (event.target.checked) {
						this.gl_quad.parameters[name[0]] = true;
					} else {
						this.gl_quad.parameters[name[0]] = false;
					}
				
				} else if (options.control === 'sampler2D') {
					// Image input
					$(event.target).next().attr("href", event.target.value);
					$("img", $(event.target).next()).attr("src", event.target.value);
					this.gl_quad.parameters[name[0]] = event.target.value;
					$("#compile").addClass("enabled");
				
				} else {
					this.gl_quad.parameters[name[0]] = event.target.val;
				}
				
				if (name[0] === 'stepSpeed') {
					speed = Math.pow(event.target.val, 2) / 100;
					this.camera.step(speed);
				}
			}	
			this.changed = true;
		}
		
		if (name[0] === this.cameraUniform) {
			this.camera.position(this.gl_quad.parameters[this.cameraUniform]);
		}
	},
	
	
	setColor: function (event) {
		var self = this,
			swatch = $(event.target),
			color = swatch.css("backgroundColor").replace(/[^0-9,]/g, '').split(","),
			picker = this.options.color_picker.data("color_picker"),
			timeout, close_timeout;
		
		this.options.color_picker
			.unbind("change")
			.bind("change", function (event, col) {
				if (col) {
					swatch.css("backgroundColor", col.css());
					self.gl_quad.parameters[swatch.attr("id")] = col.normalized();
					
					window.clearTimeout(timeout);
					timeout = window.setTimeout(function () {
						self.changed = true;
					}, 100);
				}
			});
		
		picker.setColor(color);
		
		$("#color_picker")
			.unbind("mouseover mouseout")
			.bind("mouseover", function (event) {
				self.options.color_picker.addClass("show_picker");
				window.clearTimeout(close_timeout);
			})
			.bind("mouseout", function (event) {
				window.clearTimeout(close_timeout);
				close_timeout = window.setTimeout(function () {
					$("#color_picker").hide();
				}, 100);
			})
			.toggle();
	},
	
	
	// Interacting
	interacting: function (stage) {
		if (stage) {
			this.editing_code = false;
			this.keyEvents();
			this.main();
		} else {
			this.editing_code = true;
			$(document).unbind("keydown keyup");
			window.clearInterval(this.key_listener_id);
		}
	},
	
	
	// Keep track of which keys have been pressed (thanks for the tip jaz303!)
	keyEvents: function () {
		var self = this;
		
		this.keystates = {};
		
		$(document)
			.bind("keydown", function (event) {
				self.moveMultiplier = 1;
				// console.log(event.which)
				
				if (event.shiftKey) {
					self.moveMultiplier = 10;
					self.keystates.shiftKey = true;
				}
				
				if (event.altKey) {
					self.moveMultiplier = 0.1;
					self.keystates.altKey = true;
				}
				
				if (event.ctrlKey) {
					self.keystates.ctrlKey = true;
				}
				
				if (event.metaKey) {
					self.keystates.metaKey = true;
				}
			
				if (self.keymove) {
					self.keystates[event.which] = true;
				}
			})
			.bind("keyup", function (event) {
				self.keystates[event.which] = false;
				self.moveMultiplier = 1;
				
				if (!event.shiftKey) {
					self.keystates.shiftKey = false;
				} else {
					self.moveMultiplier = 10;
				}
				
				if (!event.altKey) {
					self.keystates.altKey = false;
				} else {
					self.moveMultiplier = 0.1;
				}
				
				if (!event.ctrlKey) {
					self.keystates.ctrlKey = false;
				}
				
				if (!event.metaKey) {
					self.keystates.metaKey = false;
				}
				
				if (self.keymove) {
					self.updateUI();
				}
			});
	},
	
	
	keyListener: function () {
		var self = this,
			step, fps, 
			now = Date.now(),
			time,
			step_factor = this.moveMultiplier;
		this.tick += 1;
		dir = 1;
		
		if (this.options.mode === '2d') {
			step_factor *= 5 * this.camera.z;
			dir = -1;
		}
		
		// Move forward/back
		if (this.keystates[38] || this.keystates[87] || this.impulse.forward) {
			// w or up arrow
			this.changed = true;
			this.camera.forward(this.camera.step() * step_factor * dir);
			
		} else if (this.keystates[40] || this.keystates[83] || this.impulse.backward) {
			// s or down arrow
			this.changed = true;
			this.camera.back(this.camera.step() * step_factor * dir);		
		}
		
		// Move up or down
		if (this.keystates[81]) {
			// q
			this.changed = true;
			this.camera.down(this.camera.step() * step_factor);
			
		} else if (this.keystates[69]) {
			// e
			this.changed = true;
			this.camera.up(this.camera.step() * step_factor);
		}
		
		// Change step size
		if (this.keystates[90]) {
			// z
			this.keystates[90] = false;
			this.changed = true;
			step = $("#stepSpeed").data("superslider").value() * step_factor / 2;
			$("#stepSpeed").data("superslider").value(step);
			
		} else if (this.keystates[88]) {
			// x
			this.keystates[88] = false;
			this.changed = true;
			step = $("#stepSpeed").data("superslider").value() * step_factor * 2;
			$("#stepSpeed").data("superslider").value(step);
		}
		
		// Fullscreen mode
		if (this.keystates[70] || this.keystates[27]) {
			// f, Esc
			this.keystates[70] = false;
			this.keystates[27] = false;
			this.fullscreen();
			// $("#fullscreen").trigger("click");
		}
		
		// Save image
		if (this.keystates[73]) {
			// i
			this.keystates[73] = false;
			$("#save_image").trigger("click");
		}
		
		// Preview mode
		if (this.keystates[80]) {
			// p
			this.keystates[80] = false;
			$("#scale_size").attr("checked", !$("#scale_size").attr("checked"));
			this.resize();
		}
		
		// Strafe side to side
		if (this.keystates[37] || this.keystates[65]) {
			// a or left arrow
			this.changed = true;
			this.camera.strafeLeft(this.camera.step() * step_factor);
			
		} else if (this.keystates[39] || this.keystates[68]) {
			// d or right arrow
			this.changed = true;
			this.camera.strafeRight(this.camera.step() * step_factor);	
		}
		
		// Render changes
		if (this.changed) {
			window.clearTimeout(this.update_timeout);
			
			if (this.camera) {
				this.updateCamera();
			}
			
			if (this.mode === 'auto') {
				
				if (!this.preview_mode) {
					this.resize(false, 'preview');
				} else {
					this.gl_quad.draw();
				}
				
				this.autoUpdate();
				
			} else if (this.mode === 'preview' && !this.preview_mode) {
				this.resize(false, 'preview');
			
			} else if (this.mode === 'normal' && this.preview_mode) {
				this.resize(false, 'normal');
			
			} else if (this.mode ==='render' || this.mode ==='renderpre') {
                this.resize(false, 'render');
            } else {
				this.gl_quad.draw();
			}
			
			time = Date.now() - now;
			this.changed = false;
			this.impulse = {};
		}
		
	},
	
	
	// Auto render full res after 500 ms
	autoUpdate: function () {
		var self = this;
		
		window.clearTimeout(this.update_timeout);
		
		this.update_timeout = window.setTimeout(function () {
			if (self.pause_auto_update) {
				self.autoUpdate();
			} else {
				self.resize(false, 'full');
			}
			
		}, 500);
	},
	
	
	mouseDown: function (event) {
		var self = this;
		this.ox = event.clientX;
		this.oy = event.clientY;
		this.gl_quad.canvas[0].addEventListener("mousemove", this.mouseMoveListener, false);
		document.addEventListener("mouseup", this.mouseUpListener, false);
	},
	
	
	mouseMove: function (event) {
		var dx = event.clientX - this.ox,
			dy = event.clientY - this.oy,
			step = this.keystates.altKey ? 0.1 : 0.5,
			step_factor,
			rx, ry, 
			deg2rad = Math.PI / 180;

		this.u = dx * step;
		this.v = dy * step;
		
		if (this.options.mode === '3d') {
			// 3D camera
			if (this.keystates.metaKey) {
				
				// Spin fractal around fixed vertical axis
				ry = this.objRotationY.value() + this.u;
				if (ry > 360) {
					ry = -360 + ry % 360;
				} else if (ry < -360) {
					ry = 360 + ry % 360;
				}
				this.objRotationY.value(ry);
				
				// Spin fractal not camera
				rx = this.objRotationX.value() + this.v;
				
				if (rx > 360) {
					rx = -360 + rx % 360;
				} else if (rx < -360) {
					rx = 360 + rx % 360;
				}
				
				this.objRotationX.value(rx);
				
			} else {
				// Rotate camera
				this.gl_quad.parameters.cameraYaw += this.u;

				if (this.gl_quad.parameters.cameraYaw > 180) {
					this.gl_quad.parameters.cameraYaw = -180 + this.gl_quad.parameters.cameraYaw % 180;
				} else if (this.gl_quad.parameters.cameraYaw < -180) {
					this.gl_quad.parameters.cameraYaw = 180 + this.gl_quad.parameters.cameraYaw % 180;
				}

				this.gl_quad.parameters.cameraPitch -= this.v;
			}
		} else if (this.options.mode === '2d') {
			// 2D camera
			step_factor =  4 * this.camera.z * this.moveMultiplier / (this.gl_quad.canvas.width());
			this.camera.x -= this.u * step_factor;
			this.camera.y += this.v * step_factor;
		}

		this.ox = event.clientX;
		this.oy = event.clientY;
		this.changed = true;
	},
	
	
	mouseUp: function (event) {
		this.gl_quad.canvas[0].removeEventListener("mousemove", this.mouseMoveListener, false);
		document.removeEventListener("mouseup", this.mouseUpListener, false);
		this.updateUI();
	},
    
    // ZZ85's FUNCTIONS INJECTED HERE
    
    readyToRender: function() {
        if (!this.renderflies) this.renderflies = {};
        var fly = this ;
        var jqxhr = $.getJSON("/jobs", function(a) {
            fly.renderflies['job'] = a;
            fly.initJob();
        });
    },
    
    initJob: function() {
        var shader;
    	
		try {
			shader = {
				title: "Our shader",
				vertex: this.renderflies.job.shaders.vertex,
				fragment: this.renderflies.job.shaders.fragment,
				params: this.renderflies.job.settings
			};
            
            this.load(shader);
        
        var fly = this;
        var jqxhr = $.getJSON("/ready", function(a) {
            console.log("ready response",a);
              window.setTimeout(function() {
                    fly.renderFrame(a.id);
                 },1000);
				// I used a setTimeout seemingly as a workaround to prevent a default rendering after compiling
				// Not sure if there's a better way to do this.
           
        });
            
		} catch (e) {
			alert(e);
			return;
		}
		
	
    },
    
	// get tween position from timeline
    getTweenPosition: function(id, timeline) {
        // Results
       var timeline = this.renderflies.job.timeline;
       
       id = parseInt(id);
       var tweener; // Type of tween: eg. TWEEN.Easing.Exponential.EaseIn; or TWEEN.Easing.Linear.EaseNone;
       
       for (var i=0; i<timeline.length; i++) {
           if (timeline[i].f==id) {
               return timeline[i].o;
           } else if ( (timeline[i].f<id) 
            && (timeline[i+1].f>id)) {
               var o1 = timeline[i].o;
               var o2 = timeline[i+1].o;
               var diff = JSON.parse(JSON.stringify(o2));
               var tween = timeline[i].t;
               if (!tween) {
                   tweener = TWEEN.Easing.Linear.EaseNone;
               } else {
                   tween = tween.split(".");
                   tweener = TWEEN.Easing[tween[0]][tween[1]];
               }
               var t = (id - timeline[i].f)/ (timeline[i+1].f -timeline[i].f) ;
               //console.log("t", t);
               
               for (var o in diff) {
                   if ($.isArray(diff[o])) {
                       for (var p in diff[o]) {
                            diff[o][p] -= o1[o][p];
                            diff[o][p] *= tweener(t);
                            diff[o][p] += o1[o][p];
                       }
                   } else {
                       diff[o] -= o1[o];
                       diff[o] *= tweener(t);
                       diff[o] += o1[o];
                   }
                   
               }
               
               //console.log(diff, timeline[i].o,timeline[i+1].o);
               return diff;
               
           }
       }
       
       
    },    
    renderFrame: function(id) {
        $("#log").append("<br/>Rendering frame " + id);
        //console.log(JSON.stringify(this.gl_quad.parameters));
       
		// Trying to clear any auto rendering
		window.clearTimeout(this.resizeTimeout);
		window.clearTimeout(this.update_timeout);
       
       var here = this;
        var newCam = this.getTweenPosition(id);
        
        $.extend(here.gl_quad.parameters,newCam);
        
        here.camera = new Camera(here.gl_quad.parameters[here.cameraUniform][0],
        								 here.gl_quad.parameters[here.cameraUniform][1],
										 here.gl_quad.parameters[here.cameraUniform][2],
										 0,
										 0);
        
        var d1 = new Date().getTime();
        here.resize(false, "render");
        var img = here.canvas().toDataURL("image/png;base64");
        $("#log").append("<br/>Rendering time: " + (new Date().getTime()-d1));
        
        here.upload(img, id);
        
    },
    
    upload: function(img, id) {
        var d2 = new Date().getTime();
		var here = this;
		$.post('/upload', {
				id : id,
				img : img
			},
			function(data) {
				var d = data; 
				if (d.status) {
					$("#log").append("<br/>ID "+id +" " + d.file +" uploading time: "+ d.status + " at" + (new Date().getTime()-d2));
				} else {
                    $("#log").append("<br/>ID "+id +" " +" was uploading time:" + (new Date().getTime()-d2));
				}
                
                if (d.id) {
                    here.renderFrame(parseInt(d.id));
                }
                
		});
    },
    
    dump: function(){ 
        this.dumpData();
    },
	
    dumpData : function() {
        //DEV
		//console.log('update camera called', JSON.stringify(this.camera));
        //console.log('parameters', this.gl_quad.parameters);
        var p = this.gl_quad.parameters;
       
        var params = {
			cameraFocalLength: p.cameraFocalLength,
			cameraPitch:  p.cameraPitch,
			cameraPosition: p.cameraPosition,
            cameraRoll: p.cameraRoll,
            cameraYaw: p.cameraYaw
        };
        //DEV
		console.log('parameters', JSON.stringify(params));
    },
	
	// End of Zz85's functions
	
	updateCamera: function () {
		this.camera.pitch(this.gl_quad.parameters.cameraPitch || 0);
		this.camera.yaw(this.gl_quad.parameters.cameraYaw || 0);
		this.gl_quad.parameters[this.cameraUniform][0] = this.camera.x;
		this.gl_quad.parameters[this.cameraUniform][1] = this.camera.y;
		this.gl_quad.parameters[this.cameraUniform][2] = this.camera.z;
	},
	
	
	updateUI: function () {
		if (this.camera) {
			$("#" + this.cameraUniform + "_0").data("superslider").value(this.camera.x);
			$("#" + this.cameraUniform + "_1").data("superslider").value(this.camera.y);
			$("#" + this.cameraUniform + "_2").data("superslider").value(this.camera.z);
			
			if ($("#cameraPitch").data("superslider")) {
				$("#cameraPitch").data("superslider").value(this.gl_quad.parameters.cameraPitch);
			}
			
			if ($("#cameraPitch").data("superslider")) {
				$("#cameraYaw").data("superslider").value(this.gl_quad.parameters.cameraYaw);
			}
		}
	},
	
	
	rotationMatrix: function (a) {
		var r = Math.PI / 180,
			c = {x: Math.cos(a[0] * r), y: Math.cos(a[1] * r), z: Math.cos(a[2] * r)},
			s = {x: Math.sin(a[0] * r), y: Math.sin(a[1] * r), z: Math.sin(a[2] * r)};
        
        return [c.y * c.z,              -c.y * s.z,                s.y,
                c.z * s.x * s.y + c.x * s.z, c.x * c.z - s.x * s.y * s.z, -c.y * s.x,
               -c.x * c.z * s.y + s.x * s.z, c.z * s.x + c.x * s.y * s.z,  c.x * c.y];
	},
	
	
	imageData: function () {
		return this.gl_quad.getPixels();
	},
	
	
	canvas: function () {
		return this.quad[0];
	},
	
	
	// Main loop
	main: function () {
		var self = this;
		window.clearInterval(this.key_listener_id);
		this.key_listener_id = window.setInterval(function () {
			if (self.fps) {
				self.fps.capture();
			}
			
			self.keyListener();
			
		}, Math.round(1000 / this.options.fps));
	}
	
};



