(function($){
    //add classes to form inputs based on their type
    $('input').each(function(){
        $(this).addClass($(this).attr('type'));
    });

    //open external links in a new window
    $('a').filter(function(index){
        return /^https?:\/\/(www.)?/i.test($(this).attr('href')) && $(this).attr('href').toLowerCase().indexOf(window.location.hostname) == -1;
    }).attr('target', '_blank').addClass('external');
})(jQuery);

/******************************************************************/
//helper functions
function safeApply(scope, fn) {
    var phase = scope.$root.$$phase;
    if (phase === '$apply' || phase === '$digest')
        scope.$eval(fn);
    else
        scope.$apply(fn);
}

function getDimmensions(element) {
    return {
        x: $(element).offset().left,
        y: $(element).offset().top,
        height: 480,
        width: $(element).width()
    };
}

function dateparts2time(object, prefix) {
    var year = object[prefix + "_year"],
        month = object[prefix + "_month"],
        day = object[prefix + "_day"];
    return !year || year == -1 ? 0 : new Date(year, Math.max(month - 1, 0), Math.max(day, 1)).getTime()
}

function formatDate(date, yearAtNewLine) {
    if (!date) return "";
    if (typeof date === "number") {
        date = new Date(date)
    }
    var day = date.getDate(),
        month = date.getMonth(),
        year = date.getFullYear();
    return formatDateParts(year, month, day, yearAtNewLine)
}

function formatDateParts(year, month, day, yearAtNewLine) {
    if (!year) return "";
    if (yearAtNewLine == null) yearAtNewLine = true;
    var str = '<span class="year">' + year + "</span>";
    if (month != null) {
        str = monthNames[month] + (yearAtNewLine ? "<br>" : " ") + str;
        if (day != null) {
            str = day + " " + str
        }
    }
    return str
}

var Events = {
    on: function (name, callback, context) {
        console.log('[Events] on');
        this._events || (this._events = {});
        var list = this._events[name] || (this._events[name] = []);
        list.push({
            callback: callback,
            context: context,
            ctx: context || this
        });
        return this
    },
    off: function (name, callback, context) {
        console.log('[Events] off');
        var list, ev, events, names, i, l, j, k;
        if (!this._events) return this;
        if (!name && !callback && !context) {
            this._events = {};
            return this
        }
        names = name ? [name] : _.keys(this._events);
        for (i = 0, l = names.length; i < l; i++) {
            name = names[i];
            if (list = this._events[name]) {
                events = [];
                if (callback || context) {
                    for (j = 0, k = list.length; j < k; j++) {
                        ev = list[j];
                        if (callback && callback !== ev.callback && callback !== ev.callback._callback || context && context !== ev.context) {
                            events.push(ev)
                        }
                    }
                }
                this._events[name] = events
            }
        }
        return this
    },
    trigger: function (name) {
        console.log('[Events] trigger');
        var triggerEvents = function (events, args) {
            var ev, i = -1,
                l = events.length;
            switch (args.length) {
            case 0:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx);
                return;
            case 1:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, args[0]);
                return;
            case 2:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, args[0], args[1]);
                return;
            case 3:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, args[0], args[1], args[2]);
                return;
            default:
                while (++i < l)(ev = events[i]).callback.apply(ev.ctx, args)
            }
        };
        if (!this._events) return this;
        var args = Array.prototype.slice.call(arguments, 1);
        var events = this._events[name];
        var allEvents = this._events.all;
        if (events) triggerEvents(events, args);
        if (allEvents) triggerEvents(allEvents, arguments);
        return this
    }
};

var relationships = {
    MODE_HOME: 0,
    MODE_SHOW_VC: 4,
    MODE_SHOW_SU: 5,
    MODE_SHOW_PE: 6,
    events: {
        CATEGORY_TOOLTIP_RENDER: "categoryTooltipRender"
    },
    messages: {
        networkError: "Could not fetch the data. Please try reloading the page."
    },
    TIMEPOINT_FOUNDATION: 1,
    TIMEPOINT_ROUND1: 2,
    $: function (selector) {
        console.log('[relationships] $');
        return $(selector, this.element)
    },
    init: function () {
        console.log('[relationships] init');
        this.element = $(".relationships");
        this.svg = this.$(".startup-graph svg");
        this.dateSlider = this.$(".date-slider");
        this.currentStartups = [];
        this.initPainter();
        this.initViewModel();
        this.resize();
        this.initHistory();
        this.initWidgets();
        this.initLiveHandlers();
        tutorial.init();
        if (isMobile()) {
            this.showSuConnectionsDeferred = _.throttle(this.showSuConnections, 100)
        }
        window.deferRelationships.resolve()
    },
    initViewModel: function () {
        console.log('[relationships] initViewModel');
        var self = this;
        this.viewModel = {
            // viewMode: ko.observable(this.MODE_SHOW_SU),
            totals: {},
            // vcRelated: ko.observable([]),
            // peRelated: ko.observable([]),
            // selectedVC: ko.observable(null),
            // selectedPE: ko.observable(null),
            // activeVC: ko.observable(null),
            // activeSU: ko.observable(null),
            // activePE: ko.observable(null),
            // loading: ko.observable(false),
            // scalePosition: ko.observable(),
            // scaleWidth: ko.observable(),
            // scaleFormatted: ko.observable(),
            // scaleRoundInfo: ko.observable(""),
            legendCategories: _.map(Categories, function (cat) {
                var cloned = _.clone(cat);
                cloned.inactive = ko.observable(true);
                return cloned
            }),
            sliderVisible: ko.observable(false),
            sliderLimitLow: ko.observable(""),
            sliderLimitHigh: ko.observable(""),
            timePoint: ko.observable(this.TIMEPOINT_FOUNDATION),
            homeCategory: ko.observable(),
            homeCategoryData: ko.observable([]),
            homeCategoryLoading: ko.observable(),
            homeCategoryDataLimit: ko.observable(50),
            isAboutPage: ko.observable(false),
            showAboutPage: function () {
                console.log('[relationships] showAboutPage');
                this.isAboutPage(true);
                self.toggleAboutPage(true)
            },
            hideAboutPage: function () {
                console.log('[relationships] hideAboutPage');
                var vm = self.viewModel;
                self.toggleAboutPage(false, _.bind(vm.isAboutPage, vm, false))
            },
            startTutorial: function () {
                console.log('[relationships] startTutorial');
                self.startTutorial()
            },
            notification: ko.observable()
        };
        this.initTotals();
        this.viewModel.activeObject = ko.computed(function () {
            var vm = this.viewModel,
                vc = vm.activeVC(),
                su = vm.activeSU(),
                pe = vm.activePE(),
                mode = vm.viewMode();
            if (mode === this.MODE_HOME) return null;
            if (mode === this.MODE_SHOW_VC) return vc;
            if (mode === this.MODE_SHOW_SU) return su;
            if (mode === this.MODE_SHOW_PE) return pe
        }, this);
        this.viewModel.activeObjectName = ko.computed(function () {
            var object = this.viewModel.activeObject();
            return object ? object.name : ""
        }, this);
        this.viewModel.isHomeMode = ko.computed(function () {
            return this.viewModel.viewMode() == this.MODE_HOME
        }, this);
        this.viewModel.chartVisible = ko.computed(function () {
            var mode = this.viewModel.viewMode();
            return mode == this.MODE_SHOW_PE || mode == this.MODE_SHOW_SU || mode == this.MODE_SHOW_VC
        }, this);
        this.viewModel.homeCategoryDataToShow = ko.computed(function () {
            var data = this.viewModel.homeCategoryData();
            return data ? data.data : null
        }, this);
        this.viewModel.homeCategoryDataTruncated = ko.computed(function () {
            var data = this.viewModel.homeCategoryData();
            if (!data) return;
            return data.count > (data.data || []).length
        }, this);
        this.viewModel.homeCategoryDataCount = ko.computed(function () {
            var cnt = (this.viewModel.homeCategoryData() || []).count,
                aligned, sign = "";
            if (cnt >= 1e3) aligned = Math.floor(cnt / 1e3) * 1e3;
            else if (cnt >= 100) aligned = Math.floor(cnt / 100) * 100;
            else aligned = cnt; if (aligned !== cnt) sign = "+";
            return d3.format(",")(aligned) + sign
        }, this);
        this.viewModel.selectedVC.subscribe(_.bind(this.show, this, "vc"));
        this.viewModel.selectedPE.subscribe(_.bind(this.show, this, "pe"));
        this.viewModel.timePoint.subscribe(this.drawStartups);
        this.viewModel.activeSU.subscribe(function () {
            this.updateScaleLegend()
        }, this);
        this.viewModel.activeSU.subscribe(function (startup) {
            var mode = this.viewModel.viewMode();
            if (startup && mode != this.MODE_SHOW_SU) {
                this.highlightStartup(startup)
            } else {
                this.dehighlightStartup()
            } if (startup) {
                this.showSuConnectionsDeferred()
            } else {
                this.painter.hideSuConnections()
            }
        }, this);
        this.viewModel.isHomeMode.subscribe(this.updateHomeModeLayout);
        this.viewModel.notification.subscribe(function (message) {
            if (!message) return;
            var self = this;
            setTimeout(function () {
                self.$(".notification-container").fadeOut(1e3, function () {
                    self.viewModel.notification("")
                })
            }, 1e3)
        }, this);
        this.viewModel.scalePosition.subscribe(this.animateScalePosition);
        this.viewModel.scaleWidth.subscribe(this.animateScaleWidth);
        this.resetScaleLegend();
        ko.applyBindings(this.viewModel)
    },
    initTotals: function () {
        console.log('[relationships] initTotals');
        var totals = this.viewModel.totals;
        var formatTotal = d3.format(",");

        function addTotal(name) {
            totals[name] = {
                raw: ko.observable()
            };
            totals[name].prompt = ko.computed(function () {
                var value = totals[name].raw();
                return "Search" + (value == null ? "" : " from " + formatTotal(value))
            })
        }
        addTotal("vc");
        addTotal("su");
        addTotal("pe");
        var self = this;
        var initPlaceholders = function () {
            _.defer(function () {
                self.$("input").placeholder()
            })
        };
        API.counts(function (result) {
            if (!result) return;
            totals["vc"].raw(result.total_vcs);
            totals["su"].raw(result.total_startups);
            totals["pe"].raw(result.total_founders);
            initPlaceholders()
        })
    },
    initLiveHandlers: function () {
        console.log('[relationships] initLiveHandlers');
        var self = this;
        this.$(".list-vc").on("mouseover", ".item", this.onVcMouseover);
        this.$(".list-vc").on("mouseout", ".item", _.bind(this.painter.hideVcConnections, this.painter));
        this.$(".column1 .list-container").on("jsp-scroll-y", function () {
            if (self.viewModel.viewMode() == self.MODE_SHOW_SU) {
                self.showSuConnectionsDeferred()
            }
        });
        this.$(".categories").on("mouseenter", ".inner", function (event) {
            self.$('.search-widget input[type="text"]').blur();
            self.toggleHomeCategory(true, event)
        });
        this.$(".categories").mouseleave(function () {
            self.categoriesHideTimeout = setTimeout(_.bind(self.toggleHomeCategory, self, false), 400)
        });
        this.$(".categories").mouseenter(function () {
            clearTimeout(self.categoriesHideTimeout)
        });
        this.$(".categories .tooltip").on("click", ".tooltip-item", function (e) {
            var permalink = $(e.currentTarget).data("permalink");
            self.toggleHomeCategory(false);
            self.show("su", permalink)
        });
        $(window).on("resize", _.debounce(_.bind(this.resize, this, true), 200))
    },
    initHistory: function () {
        console.log('[relationships] initHistory');
        var self = this;
        var state = this.getState();
        this.pushState(state.mode, state.target, state.data, true);
        this.applyState(state);
        $(window).on("statechange", function () {
            self.applyState(self.getState())
        })
    },
    initPainter: function () {
        console.log('[relationships] initPainter');
        this.painter = new Painter(d3.select(this.svg[0]));
        this.painter.on("bubble:click", function (startup) {
            if (this.viewModel.viewMode() == this.MODE_SHOW_SU) return;
            this.show("su", startup.permalink)
        }, this);
        this.painter.on("bubble:mouseenter", function (startup) {
            if (this.viewModel.viewMode() == this.MODE_SHOW_SU) return;
            this.viewModel.activeSU(startup)
        }, this);
        this.painter.on("bubble:mouseleave", function () {
            if (this.viewModel.viewMode() == this.MODE_SHOW_SU) return;
            this.viewModel.activeSU(null)
        }, this);
        this.painter.on("bubbleRound:mouseenter", this.showRoundDetails, this);
        this.painter.on("bubbleRound:mouseleave", this.hideRoundDetails, this)
    },
    initWidgets: function () {
        console.log('[relationships] initWidgets');
        var self = this;

        function initAutocomplete(target) {
            console.log('[relationships] initAutocomplete');
            var input = self.$(".column-" + target).find('.search-widget input[type="text"]');
            input.autocomplete(API.getPath("search", target), {
                queryParamName: false,
                remoteDataType: "json",
                maxItemsToShow: 0,
                selectFirst: true,
                processData: function (data) {
                    console.log('[relationships] processData');
                    return _.map(data, function (item) {
                        return {
                            value: item.name,
                            data: item
                        }
                    })
                },
                onItemSelect: function (obj, widget) {
                    console.log('[relationships] onItemSelect');
                    var item = obj.data;
                    self.show(target, item.permalink);
                    widget.setValue("")
                },
                onShow: function (dummy, widget) {
                    console.log('[relationships] onShow');
                    var $results = widget.dom.$results,
                        inner = $results.find(".acResultsInner"),
                        ul = $results.find(".acResultsList");
                    if (!ul.length) return;
                    if (inner.data("jsp")) {
                        inner.data("jsp", null)
                    }
                    inner.jScrollPane()
                }
            });
            input.focus(function () {
                input.keydown()
            })
        }
        this.$(".scrollable").jScrollPane();
        initAutocomplete("vc");
        initAutocomplete("su");
        initAutocomplete("pe");
        this.viewModel.activeSU.subscribe(function () {
            self.$(".profile-su .scrollable").jScrollPane()
        })
    },
    getState: function () {
        console.log('[relationships] getState');
        var historyState = History.getState(),
            state = historyState.data;
        if (!state.mode) {
            var base = $("head base").attr("href") || "/";
            var path = historyState.hash.replace(base, "");
            var parsed = path.match(/^#?(show)\/(su|vc|pe)\/(.+)($|\?)/i);
            if (parsed) {
                state = {
                    mode: parsed[1].toLowerCase(),
                    target: parsed[2].toLowerCase(),
                    data: parsed[3]
                }
            }
        }
        if (!state.mode) {
            state = {}
        }
        return state
    },
    applyState: function (state) {
        console.log('[relationships] applyState');
        if (state.mode === "show") {
            this.doShow(state.target, state.data)
        } else {
            this.viewModel.viewMode(this.MODE_HOME)
        }
    },
    pushState: function (mode, target, data, replace) {
        console.log('[relationships] pushState');
        var url = mode ? [mode, target, data].join("/") : ".";
        History[replace ? "replaceState" : "pushState"]({
            mode: mode,
            target: target,
            data: data
        }, null, url)
    },
    setViewMode: function (action, target) {
        console.log('[relationships] setViewMode');
        var modeName = ("mode_" + action + "_" + target).toLocaleUpperCase();
        this.viewModel.viewMode(this[modeName])
    },
    resize: function (needRepaint) {
        console.log('[relationships] resize');
        var headerHeight = this.$(".content").position().top,
            footerHeight = this.$(".footer").outerHeight(true),
            contentHeight = this.element.height() - headerHeight - footerHeight;
        this.$(".content").height(contentHeight);
        if (needRepaint) {
            this.drawStartups();
            this.updateScrollbars();
            if (this.viewModel.viewMode() == this.MODE_SHOW_SU) {
                this.showSuConnectionsDeferred();
                this.$(".profile-su .scrollable").each(function () {
                    var api = $(this).data("jsp");
                    api && _.defer(_.bind(api.reinitialise, api))
                })
            }
            if (this.viewModel.isHomeMode()) {
                this.updateHomeModeLayout()
            }
        }
    },
    show: function (target, permalink) {
        console.log('[relationships] show');
        if (!permalink) return;
        this.pushState("show", target, permalink)
    },
    doShow: function (target, permalink) {
        console.log('[relationships] doShow');
        if (!permalink) return;
        var self = this,
            methods = {
                vc: this.showVC,
                su: this.showSU,
                pe: this.showPE
            };
        var callback = function (item) {
            console.log('[relationships] callback');
            self.setViewMode("show", target);
            self.resize();
            self.clearSVG();
            methods[target].call(self, item);
            _(["vc", "su", "pe"]).without(target).each(function (t) {
                self.viewModel["active" + t.toUpperCase()](null)
            });
            _(["vc", "pe"]).without(target).each(function (t) {
                self.viewModel["selected" + t.toUpperCase()](null)
            });
            if (target !== "su") {
                self.resetScaleLegend()
            }
            self.viewModel["active" + target.toUpperCase()](item);
            if (!item) {
                self.viewModel.notification(self.messages.networkError)
            }
            self.viewModel.loading(false);
            self.updateSharingButtons()
        };
        this.viewModel.loading(true);
        _.defer(function () {
            API.relations(target, permalink, callback)
        })
    },
    showVC: function (investor) {
        console.log('[relationships] showVC');
        this.currentStartups = investor && investor.startups || [];
        this.drawStartups();
        this.viewModel.vcRelated(investor ? [
            [investor]
        ] : [
            []
        ])
    },
    showSU: function (startup) {
        console.log('[relationships] showSU');
        this.currentStartups = startup ? [startup] : [];
        this.drawStartups()
    },
    showPE: function (founder) {
        console.log('[relationships] showPE');
        this.currentStartups = founder && founder.startups;
        this.drawStartups();
        this.viewModel.peRelated(founder ? [
            [founder]
        ] : [
            []
        ])
    },
    clearSVG: function () {
        console.log('[relationships] clearSVG');
        this.painter && this.painter.clear()
    },
    getBubblesArea: function () {
        console.log('[relationships] getBubblesArea');
        var col2 = this.$(".content .column-su"),
            graphWidth = col2.width(),
            graphHeight = this.svg.parent().height(),
            graphLeft = col2.offset().left + parseInt(col2.css("padding-left"), 10);
        return {
            left: +graphLeft,
            top: 0,
            width: +graphWidth,
            height: +graphHeight
        }
    },
    bubbleArea2AbsoluteX: function (x) {
        console.log('[relationships] bubbleArea2AbsoluteX');
        return x + this.painter.left
    },
    absolute2Chart: function (point) {
        console.log('[relationships] absolute2Chart');
        var chartOffset = this.svg.parent().offset();
        return {
            x: point.x - chartOffset.left,
            y: point.y - chartOffset.top
        }
    },
    getStartupFounders: function (startup) {
        console.log('[relationships] getStartupFounders');
        return _.sortBy(startup && startup.people, "name")
    },
    getStartupInvestorsByRound: function (startup) {
        console.log('[relationships] getStartupInvestorsByRound');
        return _.map(startup && startup.funding_rounds, function (round) {
            return _.sortBy(round.investors, "name")
        })
    },
    getStartupInvestors: function (startup) {
        console.log('[relationships] getStartupInvestors');
        return _(startup && startup.funding_rounds).pluck("investors").flatten().uniq(function (investor) {
            return investor.permalink
        }).sortBy("name").value()
    },
    updateRelationships: function () {
        console.log('[relationships] updateRelationships');
        var startups = this.painter.getRenderedStartups(),
            mode = this.viewModel.viewMode();
        if (mode == this.MODE_SHOW_VC || mode == this.MODE_SHOW_SU) {
            var founders = _.map(startups, this.getStartupFounders);
            this.viewModel.peRelated(founders)
        }
        if (mode == this.MODE_SHOW_PE) {
            var investors = _.map(startups, this.getStartupInvestors);
            this.viewModel.vcRelated(investors)
        } else if (mode == this.MODE_SHOW_SU) {
            var investorsByRound = this.getStartupInvestorsByRound(startups[0]);
            this.viewModel.vcRelated(investorsByRound)
        }
        this.updateScrollbars();
        this.updateLegendCategories()
    },
    updateScaleLegend: function (startup, roundIndex) {
        console.log('[relationships] updateScaleLegend');
        var sum, radius, scaleRoundText;
        if (startup) {
            var round = startup.funding_rounds[roundIndex];
            var date = formatDateParts(round.funded_year, round.funded_month, round.funded_day, false);
            sum = round.raised_amount;
            radius = (startup.sum ? sum / startup.sum : 1) * startup.radius;
            scaleRoundText = "Round " + (roundIndex + 1);
            if (date) scaleRoundText = scaleRoundText + " (" + date + ")"
        } else {
            startup = this.viewModel.activeSU();
            if (!startup) return;
            sum = startup.sum;
            radius = startup.radius;
            scaleRoundText = ""
        }
        radius = Math.max(radius, 8);
        var centerX = this.bubbleArea2AbsoluteX(startup.x),
            width = radius * 2,
            formatted;
        if (sum >= 1e9) formatted = d3.round(sum / 1e9, 1) + "B";
        else if (sum >= 1e7) formatted = d3.round(sum / 1e6, 0) + "M";
        else if (sum >= 1e6) formatted = d3.round(sum / 1e6, 1) + "M";
        else if (sum >= 1e4) formatted = d3.round(sum / 1e3, 0) + "K";
        else if (sum >= 1e3) formatted = d3.round(sum / 1e3, 1) + "K";
        else if (sum > 0) formatted = d3.round(sum, 0);
        else formatted = "0";
        this.viewModel.scalePosition(centerX);
        this.viewModel.scaleWidth(width + "px");
        this.viewModel.scaleFormatted("$" + formatted);
        this.viewModel.scaleRoundInfo(scaleRoundText)
    },
    resetScaleLegend: function () {
        console.log('[relationships] resetScaleLegend');
        this.viewModel.scalePosition(-100);
        this.viewModel.scaleWidth("5em");
        this.viewModel.scaleFormatted("");
        this.viewModel.scaleRoundInfo("")
    },
    animate: function (el, attrs) {
        console.log('[relationships] animate');
        if (Modernizr.csstransitions) {
            el.css(attrs)
        } else {
            el.stop(true, false).animate(attrs)
        }
    },
    animateScalePosition: function () {
        console.log('[relationships] animateScalePosition');
        var el = this.$(".arrow-scale-floater"),
            width = el.width(),
            centerX = this.viewModel.scalePosition(),
            left = centerX - width / 2;
        this.animate(el, {
            left: left
        })
    },
    animateScaleWidth: function () {
        console.log('[relationships] animateScaleWidth');
        this.animate(this.$(".arrow-scale-outer"), {
            width: this.viewModel.scaleWidth()
        })
    },
    updateLegendCategories: function () {
        console.log('[relationships] updateLegendCategories');
        var activeCategories = _.isEmpty(this.currentStartups) ? [] : _(this.painter.getRenderedStartups()).pluck("category_code").uniq().value();
        _(this.viewModel.legendCategories).each(function (cat) {
            cat.inactive(!_.contains(activeCategories, cat.id))
        })
    },
    calculateYearWidth: function (minDate, maxDate) {
        console.log('[relationships] calculateYearWidth');
        var years = (maxDate - minDate) / (1e3 * 60 * 60 * 24 * 365.25);
        return this.axisWidth / years
    },
    getAxisDashArray: function (yearWidth, date1, date2) {
        console.log('[relationships] getAxisDashArray');
        var DASH_GAP = 5;

        function year2date(year) {
            return new Date(year, 0, 1)
        }
        var year1 = new Date(date1).getFullYear(),
            year2 = new Date(date2).getFullYear();
        if (year1 === year2) return yearWidth;
        var dash1 = (year2date(year1 + 1) - date1) / (year2date(year1 + 1) - year2date(year1)) * yearWidth,
            dash2 = (date2 - year2date(year2)) / (year2date(year2 + 1) - year2date(year2)) * yearWidth,
            dashes = [];
        for (var i = 0, l = year2 - year1 - 1; i < l; i++) {
            dashes[i] = yearWidth
        }
        dashes.unshift(dash1);
        dashes.push(dash2 < yearWidth ? dash2 + DASH_GAP : dash2);
        return _.map(dashes, function (width) {
            var dashWidth = Math.max(width - DASH_GAP, 0) || 0,
                gapWidth = width - dashWidth || 0;
            return dashWidth + "," + gapWidth
        }).join(",")
    },
    initTimeAxis: function (minDate, maxDate) {
        console.log('[relationships] initTimeAxis');
        this.axisWidth = this.$(".axis-chart").width();
        this.yearWidthTotal = this.calculateYearWidth(minDate, maxDate);
        var dashArray = this.getAxisDashArray(this.yearWidthTotal, minDate, maxDate);
        d3.select(this.$(".axis-total .segment1")[0]).style("stroke-dasharray", dashArray)
    },
    updateTimeAxis: function () {
        console.log('[relationships] updateTimeAxis');
        var values = this.dateSlider.noUiSliderMod("value"),
            yearWidth = this.calculateYearWidth(values[0], values[1]),
            handle1 = this.dateSlider.find(".noUi-lowerHandle"),
            handle2 = this.dateSlider.find(".noUi-upperHandle"),
            axisSelected = this.$(".axis-selected"),
            axisTotal = this.$(".axis-total"),
            conn1 = this.$(".axis-connection-1"),
            conn2 = this.$(".axis-connection-2"),
            left = handle1.position().left,
            right = handle2.position().left;
        var dashArraySelected = this.getAxisDashArray(yearWidth, values[0], values[1]),
            dashArrayTotal = this.getAxisDashArray(this.yearWidthTotal, values[0], values[1]);
        d3.select(axisSelected[0]).style("stroke-dasharray", dashArraySelected);
        d3.select(axisTotal[0]).select(".segment2").attr("x1", left).attr("x2", right).style("stroke-dasharray", dashArrayTotal);
        conn1.find(".segment2").attr("x2", left);
        conn1.find(".segment3").attr({
            x1: left,
            x2: left
        });
        conn2.find(".segment2").attr("x1", right);
        conn2.find(".segment3").attr({
            x1: right,
            x2: right
        })
    },
    prepareStartups: function () {
        console.log('[relationships] prepareStartups');
        var timepoint = this.viewModel.timePoint();
        _(this.currentStartups).each(function (startup) {
            if (timepoint == this.TIMEPOINT_FOUNDATION) {
                startup.date = startup.founded_date
            } else if (timepoint == this.TIMEPOINT_ROUND1) {
                startup.date = startup.round_dates[0]
            }
        }, this)
    },
    drawStartups: function () {
        console.log('[relationships] drawStartups');
        this.prepareStartups();
        this.painter.setStartupView(this.viewModel.viewMode() === this.MODE_SHOW_SU);
        if (this.currentStartups.length === 1) {
            this.drawSingleStartup(this.currentStartups[0])
        } else {
            this.drawMultipleStartups(this.currentStartups)
        }
        this.updateRelationships()
    },
    drawSingleStartup: function (startup) {
        console.log('[relationships] drawSingleStartup');     
        this.viewModel.sliderVisible(false);
        this.painter.setArea(this.getBubblesArea());
        this.painter.drawSingleStartup(startup)
    },
    drawMultipleStartups: function (startups) {
        console.log('[relationships] drawMultipleStartups');
        var self = this;
        startups = _.filter(startups, function (s) {
            return s.date
        });
        var dates = _(startups).pluck("date").sortBy(_.identity).value(),
            minDate = dates[0],
            maxDate = dates[dates.length - 1];
        this.dateSlider.empty();
        this.viewModel.sliderVisible( !! minDate && startups.length > 1);
        this.dateSlider.noUiSliderMod("init", {
            scale: [minDate, maxDate],
            start: [minDate, maxDate],
            format: formatDate,
            change: this.updateTimeAxis,
            end: function () {
                var values = this.noUiSliderMod("value");
                self.painter.drawDateRange(values[0], values[1]);
                self.updateRelationships();
                self.resetScaleLegend()
            }
        });
        this.initTimeAxis(minDate, maxDate);
        this.updateTimeAxis();
        this.viewModel.sliderLimitLow(formatDate(minDate));
        this.viewModel.sliderLimitHigh(formatDate(maxDate));
        this.painter.setArea(this.getBubblesArea());
        this.painter.setStartups(startups);
        this.painter.drawDateRange(minDate, maxDate)
    },
    updateScrollbars: function () {
        console.log('[relationships] updateScrollbars');
        this.$(".content .scrollable").each(function () {
            var api = $(this).data("jsp");
            api && _.defer(_.bind(api.reinitialise, api))
        })
    },
    getVcConnectionPoint: function ($el) {
        console.log('[relationships] getVcConnectionPoint');
        $el = $($el);
        var offset = $el.offset();
        return this.absolute2Chart({
            x: offset.left + $el.width() + 10,
            y: offset.top + $el.height() / 2
        })
    },
    getPeConnectionPoint: function ($el) {
        console.log('[relationships] getPeConnectionPoint');
        $el = $($el);
        var offset = $el.offset();
        return this.absolute2Chart({
            x: offset.left - 10,
            y: offset.top + $el.height() / 2
        })
    },
    onVcMouseover: function (event) {
        console.log('[relationships] onVcMouseover');
        if (this.viewModel.viewMode() == this.MODE_SHOW_SU) return;
        var $el = $(event.currentTarget);
        var permalink = $el.data("permalink"),
            point = this.getVcConnectionPoint($el);
        this.painter.showVcConnections(permalink, point)
    },
    showSuConnections: function () {
        console.log('[relationships] showSuConnections');
        var startup = this.viewModel.activeSU();
        if (!startup) return;
        var vcPointsByRound = _.map(this.$(".list-vc .list-content"), function (list, i) {
            return _.map($(".item", list), this.getVcConnectionPoint)
        }, this);
        var pePoints = _.map(this.$(".list-pe .item"), this.getPeConnectionPoint);
        this.painter.showSuConnections(startup.permalink, vcPointsByRound, pePoints)
    },
    showSuConnectionsDeferred: function () {
        console.log('[relationships] showSuConnectionsDeferred');
        _.defer(this.showSuConnections)
    },
    showRoundDetails: function (startup, roundIndex) {
        console.log('[relationships] showRoundDetails');
        this.updateScaleLegend(startup, roundIndex)
    },
    hideRoundDetails: function () {
        console.log('[relationships] hideRoundDetails');
        this.updateScaleLegend()
    },
    highlightStartup: function (startup) {
        console.log('[relationships] highlightStartup');
        this.painter.highlightStartup(startup);
        this.viewModel.peRelated([this.getStartupFounders(startup)]);
        this.viewModel.vcRelated(this.getStartupInvestorsByRound(startup));
        this.updateScrollbars()
    },
    dehighlightStartup: function () {
        console.log('[relationships] dehighlightStartup');
        var vm = this.viewModel,
            mode = vm.viewMode();
        this.painter.dehighlight();
        this.updateRelationships();
        if (mode == this.MODE_SHOW_PE) {
            vm.activePE() && vm.peRelated([
                [vm.activePE()]
            ])
        } else if (mode == this.MODE_SHOW_VC) {
            vm.activeVC() && vm.vcRelated([
                [vm.activeVC()]
            ])
        }
    },
    resetSelection: function () {
        console.log('[relationships] resetSelection');
        var vm = this.viewModel;
        vm.selectedVC(null);
        vm.activeSU(null);
        vm.selectedPE(null);
        this.currentStartups = [];
        this.resetScaleLegend();
        this.updateLegendCategories()
    },
    updateHomeModeLayout: function () {
        console.log('[relationships] updateHomeModeLayout');
        var homeMode = this.viewModel.isHomeMode(),
            col1Left = 0,
            col3Right = 0,
            searchBlock = this.$(".search-block"),
            col1 = searchBlock.find(".column1"),
            col2 = searchBlock.find(".column2"),
            col3 = searchBlock.find(".column3"),
            colWidth = col2.width(),
            col2Position = col2.position(),
            padding = 80;
        if (homeMode) {
            col1Left = col2[0].offsetLeft - colWidth - padding;
            col3Right = col2.parent().width() - (col2[0].offsetLeft + col2.outerWidth()) - colWidth - padding;
            this.resetSelection();
            this.pushState()
        }
        searchBlock.find(".column1").animate({
            left: col1Left
        });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
    },
    toggleHomeCategory: function (visible, event) {
        console.log('[relationships] toggleHomeCategory');
        var vm = this.viewModel;
        if (!visible) {
            vm.homeCategory(null);
            vm.homeCategoryData([]);
            return
        }
        var $el = $(event.currentTarget),
            $item = $el.parents(".item"),
            category = Categories[$item.data("category")],
            self = this;
        if (category === vm.homeCategory()) return;
        vm.homeCategoryData([]);
        vm.homeCategoryLoading(true);
        vm.homeCategory(category);
        var tooltip = $item.parents(".categories").find(".tooltip");
        var left = $item.position().left + $el.outerWidth() / 2 - tooltip.outerWidth() / 2 - 2;
        tooltip.css({
            left: left
        });
        API.categories(category.id, this.viewModel.homeCategoryDataLimit(), function (data) {
            if (vm.homeCategory() !== category) return;
            if (!data) return;
            vm.homeCategoryData(data);
            vm.homeCategoryLoading(false);
            _.defer(function () {
                tooltip.find(".acResultsInner").jScrollPane();
                self.trigger(self.events.CATEGORY_TOOLTIP_RENDER)
            })
        })
    },
    toggleAboutPage: function (visible, callback) {
        console.log('[relationships] toggleAboutPage');
        var page = this.$(".about-page"),
            width = page.width() + page.find(".about-decoration").width(),
            endPos = visible ? 0 : -width;
        if (visible) {
            page.css("left", -width)
        }
        page.animate({
            left: endPos
        }, "fast", callback)
    },
    startTutorial: function () {
        console.log('[relationships] startTutorial');
        tutorial.start(this.endTutorial)
    },
    endTutorial: function () {
        console.log('[relationships] endTutorial');
        this.viewModel.hideAboutPage();
        this.pushState();
        this.toggleHomeCategory(false)
    },
    getCurrentObject: function () {
        console.log('[relationships] getCurrentObject');
        return this.viewModel.activeObject()
    },
    formatShareCount: function (count) {
        console.log('[relationships] formatShareCount');
        if (count < 1e3) return "" + count;
        if (count < 1e5) return (count / 1e3).toFixed(1) + "k";
        if (count < 1e6) return (count / 1e3).toFixed(0) + "k";
        if (count < 1e8) return (count / 1e6).toFixed(1) + "M"
    },
    getShareText: function (mode, data) {
        console.log('[relationships] getShareText');
        var text, name = data && data.name;
        if (mode === this.MODE_SHOW_VC) {
            text = "Want to see " + name + "'s most successful investments? Check out Visually's Startup Universe for a full profile and history"
        } else if (mode === this.MODE_SHOW_SU) {
            text = "Check out the financial universe of " + name + ", its founders' stories and investors, at Visually's Startup Universe"
        } else if (mode === this.MODE_SHOW_PE) {
            text = "Check out " + name + "'s startup history and relationships with founders and investors on Visually's Startup Universe"
        } else {
            text = "Uncover new stories and make sense of the complex relationships between startups, founders and Venture Capitalists with Visually's Startup Universe"
        }
        return text
    },
    getShareUrl: function () {
        console.log('[relationships] getShareUrl');
        return History.getState().cleanUrl
    },
    getShareTitle: function () {
        console.log('[relationships] getShareTitle');
        return "The Startup Universe"
    },
    getShareImage: function () {
        console.log('[relationships] getShareImage');
        return $('head meta[property="og:image"]').attr("content")
    },
    updateTwitterButton: function () {
        console.log('[relationships] updateTwitterButton');
        var text, twitterId, url = this.getShareUrl(),
            mode = this.viewModel.viewMode(),
            data = this.getCurrentObject();
        if (data) {
            twitterId = data.twitter_username ? "@" + data.twitter_username : data.name
        }
        if (mode === this.MODE_SHOW_VC) {
            text = "Want to see " + twitterId + "'s most successful investments? Check out @Visually's Startup Universe"
        } else if (mode === this.MODE_SHOW_SU) {
            text = "Check out the complex story of " + twitterId + ", its founders and investors, at @Visually's Startup Universe"
        } else if (mode === this.MODE_SHOW_PE) {
            text = "Check out the startup story, founders and investors of " + twitterId + " on @Visually's Startup Universe"
        } else {
            text = "Uncover new stories and learn about the relationships between startups, founders and VCs with @Visually's Startup Universe"
        }
        window.stWidget.addEntry({
            service: "twitter",
            type: "custom",
            element: this.$(".twitter-button")[0],
            url: url,
            title: text,
            text: ""
        });
        window.stButtons.getCount(url, "twitter", this.$(".twitter-button .count")[0])
    },
    updateFacebookButton: function () {
        console.log('[relationships] updateFacebookButton');
        var url = this.getShareUrl(),
            self = this,
            mode = this.viewModel.viewMode(),
            data = this.getCurrentObject();
        var attr = {
            method: "feed",
            display: "popup",
            link: url,
            picture: this.getShareImage(),
            name: this.getShareTitle(),
            description: this.getShareText(mode, data),
            caption: " "
        };
        var onClick = function () {
            console.log('[relationships] onClick');
            window.FB.ui(attr)
        };
        this.$(".facebook-button").off("click").click(onClick);
        var defer = $.Deferred();
        window.FB.api({
            method: "fql.query",
            query: 'SELECT share_count FROM link_stat WHERE url = "' + url + '"'
        }, function (data) {
            $(".facebook-button .count").text(self.formatShareCount(data[0] ? data[0].share_count : 0));
            defer.resolve()
        });
        return defer
    },
    updateLinkedButton: function () {
        console.log('[relationships] updateLinkedButton');
        var url = this.getShareUrl(),
            self = this,
            mode = this.viewModel.viewMode(),
            data = this.getCurrentObject();
        window.stWidget.addEntry({
            service: "linkedin",
            type: "custom",
            element: this.$(".linked-button")[0],
            url: url,
            title: this.getShareTitle(),
            summary: this.getShareText(mode, data)
        });
        window.IN.Tags.Share.getCount(url, function (count) {
            $(".linked-button .count").text(self.formatShareCount(count))
        })
    },
    updateSharingButtons: function () {
        console.log('[relationships] updateSharingButtons');
        try {
            this.updateTwitterButton()
        } catch (e) {}
        if (window.deferIn.state() !== "resolved") return;
        try {
            this.updateFacebookButton()
        } catch (e) {}
        try {
            this.updateLinkedButton()
        } catch (e) {}
    }
};

jQuery.extend(relationships, Events);
var Painter = function (chart) {
    this.chart = chart;
    this.renderQueue = []
};
jQuery.extend(Painter.prototype, Events);

Painter.prototype.BUBBLE_PADDING = 2;
Painter.prototype.TITLE_HEIGHT = 20;
Painter.prototype.CHART_MARGIN_RELATIVE = .14;
Painter.prototype.CHART_MARGIN_BOTTOM = 32;
Painter.prototype.MIN_BUBBLE_RADIUS = 2;
Painter.prototype.MAX_BUBBLE_SIZE_RELATIVE = .8;

var Categories = {};
(function () {
    var order = 0;

    function makeCategory(id, name, color) {
        Categories[id] = {
            id: id,
            name: name,
            color: color,
            order: order++
        }
    }
    makeCategory("advertising", "Advertising", "#e1b375");
    makeCategory("public_relations", "Communication", "#9d844f");
    makeCategory("education", "Education", "#ccac3a");
    makeCategory("web", "Consumer Web", "#606b3e");
    makeCategory("ecommerce", "eCommerce", "#b0b960");
    makeCategory("search", "Search", "#497874");
    makeCategory("biotech", "Biotech", "#67adbb");
    makeCategory("cleantech", "CleanTech", "#b2cdcf");
    makeCategory("semiconductor", "Semiconductor", "#325a86");
    makeCategory("hardware", "C. E./Devices", "#835a79");
    makeCategory("mobile", "Mobile/Wireless", "#673239");
    makeCategory("network_hosting", "Network/Hosting", "#ba8171");
    makeCategory("games_video", "Entertainment", "#ad5454");
    makeCategory("software", "Software", "#871738");
    makeCategory("security", "Security", "#d7a3b5");
    makeCategory("legal", "Legal", "#b16642");
    makeCategory("enterprise", "Enterprise", "#ce9043");
    makeCategory("consulting", "Consulting", "#e3cdbf");
    makeCategory("other", "Other", "#626365");
    makeCategory("undefined", "Not defined", "#bebebf")
})();

// start the relationships logic
$(function () {
    relationships.init()
});

//define applicaton
var wizualyApp = angular.module('wizualy', ['ngResource', 'ngRoute', 'ngSanitize']);

wizualyApp.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}
]);

//chart directive
angular.module('wizualy').directive('bubbleChart', function () {
    // constants
    var MAX_BUBBLE_SIZE_RELATIVE = .8,
        MIN_BUBBLE_SIZE = 2,
        margin = 20,
        width = 960,
        height = 500 - margin,
        color = d3.interpolateRgb("#f77", "#77f"),
        scale = d3.scale.linear(),
        cluster = d3.layout.cluster().size([height, width - 160]),
        diagonal = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });

    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        scope: {
            entities: '='
        },
        link: function (scope, element, attrs) {
            var container = getDimmensions(element[0]),
                chart = d3.select( element[0] )
                    .append("svg")
                    .attr("width", container.width * MAX_BUBBLE_SIZE_RELATIVE)
                    .attr("height", container.height * MAX_BUBBLE_SIZE_RELATIVE);

            scope.drawConnection = function(node, htmlId, point) {
                console.log('point: ', point);

                var x1 = point.x,
                    y1 = point.y,
                    x2 = 89,
                    y2 = 200,
                    curveX = (x2 + x1) / 2,
                    controlX1 = x1 + (curveX - x1) / 5,
                    controlX2 = x1 + (curveX - x1) / 2;

                    console.log('a(', x1, ", ", y1, "), b(", x2, " ,", y2, ")");
                    console.log("curveX: ", curveX);
                    console.log("controlX1: ", controlX1);
                    console.log("controlX2: ", controlX2);
                    console.log('node:', node);

                    node.append("line")
                            .attr("x1", x2)
                            .attr("y1", y2)
                            .attr("x2", curveX)
                            .attr("y2", y2);

                    x1 = 240;
                    y1 = 9.5;
                    controlX1 = 312.35;
                    controlX2 = 420.875;
                    y2 = 210.5;
                    curveX = 601.75;

                    node.append("path")
                            .attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(","))
                            .style("fill", "transparent")
            };

            scope.showConnections = function (investors) {
                
                var self = this;
                console.log('this: ', this);

                var g = chart.append("g")
                    .datum(investors)
                        .attr("class", "connections")
                        .attr("width", container.width)
                        .attr("height", container.height);

                console.log('investors: ', investors);

                angular.forEach(investors, function(value, i) {

                    console.log('investor: ', value);
                    var node = g.append("g")
                        .datum(value)
                            .attr("class", "link-su link-su-vc");

                    angular.forEach(value.investor.investors, function(investment, ii) {
                        console.log('investment: ', investment);

                        var point = {x: value.x, y: value.y};
                        console.log('mypoint: ', point);

                        scope.drawConnection(node, "#vc-"+investment.permalink, point);
                    });
                });

                // var vcData = angular.forEach(entity.round_radiuses, function (r, i) {
                //     var vcPoints = vcPointsByRound[i];
                //     if (!vcPoints) return null;
                //     return _.map(vcPoints, function (vcPoint) {
                //         return {
                //             x1: vcPoint.x,
                //             y1: Math.floor(vcPoint.y) + .5,
                //             x2: startup.x + self.left,
                //             y2: Math.floor(startup.y + r + self.top) + .5
                //         }
                //     })
                // }).flatten().without(null).value();

                // this.chart.select(".connections").selectAll(".link-su-vc").data(vcData).enter().append("g").attr("class", "link-su link-su-vc").each(function (d) {
                //     var node = d3.select(this);
                //     var x1 = d.x1,
                //         y1 = d.y1,
                //         x2 = d.x2,
                //         y2 = d.y2,
                //         curveX = (x2 + x1) / 2,
                //         controlX1 = x1 + (curveX - x1) / 5,
                //         controlX2 = x1 + (curveX - x1) / 2;
                //     node.append("line").attr("x1", x2).attr("y1", y2).attr("x2", curveX).attr("y2", y2);
                //     node.append("path").attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(",")).style("fill", "transparent")
                // })
            };

            scope.drawBubble = function (entity) {

                // console.log('[DEBUG] container: ', container);
                
                var g, self = this,
                    content = $('#content'),
                    strokeColor = '#000',
                    cx = Math.ceil((container.x + container.width) / 2) - 300,
                    cy = Math.ceil((container.y + container.height) / 2) - 80; 

                var g = chart.append("g")
                    .datum(entity)
                        .attr("class", "bubble")
                        .attr("width", container.width)
                        .attr("height", container.height);

                var R = Math.round(Math.min(container.height, container.width) * 0.3);

                console.log('entity: ', entity);
                console.log('total: ', entity.total, ', length: ', entity.funding_rounds.length);

                var linearScale = d3.scale.linear().domain([0, entity.total]).range([MIN_BUBBLE_SIZE, R]);
                console.log('linear(2): ', linearScale(2));
                console.log('linear(167500000): ', linearScale(167500000));
                console.log('linear(90000000): ', linearScale(90000000));

                g.append("circle")
                    .attr("class", "bubble-round")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", R )
                    .style("fill", '#9d844f');

                var t = 0;
                var round_radiuses = [];
                var investors = [];
                angular.forEach(entity.funding_rounds, function(e, i) {
                    var r = linearScale(e.raised_amount + t);
                    t += e.raised_amount;

                    // add each funding .. as event timeline
                    g.append("circle")
                        .attr("class", "bubble-round")
                        .attr("cx", cx)
                        .attr("cy", cy)
                        .attr("r",  r)
                        .style("stroke", "#554")
                        .style("stroke-width", 1.3)
                        .style("fill", "transparent");

                    round_radiuses.push(r);
                    investors.push({investor: e, x: cx, y: cy + r});
                });

                // display the links between a VC (col1) and round
                scope.showConnections(investors);
            };

            scope.$watch('entities', function(data){
                if(typeof data != 'undefined') {
                    // console.log('data: ', data.length);

                    scope.drawBubble(data);
                } else {
                    console.log('[DEBUG] data is undefined');
                }
            });
        }
    }
});

//placeholder
angular.module('wizualy').directive('placeholder', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs){
            var self = $(element[0]);

            if(!Modernizr.placeholder && attrs.placeholder != ''){
                self.val(attrs.placeholder);

                self.addClass('has-placeholder');

                self.focus(function(){
                    if(self.val() == attrs.placeholder) {
                        self.val('');
                        self.removeClass('has-placeholder');
                    }
                });

                self.blur(function(){
                    if(self.val() === ''){
                        self.val(attrs.placeholder);
                        self.addClass('has-placeholder');
                    }
                });
            }
        }
    }
});

//custom scrollbar directive
angular.module('wizualy').directive('scrollPane', function () {
    return {
        restrict: 'C',
        replace: true,
        priority: 1000,
        link: function (scope, element, attrs){
            $(element[0]).jScrollPane({
                autoReinitialise: true,
                contentWidth: '0px'
            });
        }
    }
});

//dropdowns
angular.module('wizualy').directive('dropDown', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs){
            var hideMenu = false;

            $(element[0]).mouseenter(function(){
                $(this).siblings().removeClass('on');
                $(this).addClass('on');
                if(hideMenu){
                    clearTimeout(hideMenu);
                }
            }).mouseleave(function(){
                hideMenu = setTimeout(function(){
                    $(element[0]).removeClass('on');
                }, 1000);
            });
        }
    }
});

//autocomplete
angular.module('wizualy').directive('autoComplete', function ($location) {
    return {
        restrict: 'C',
        scope: {
            source: '@source',
            minlength: '@minlength'
        },
        link: function (scope, element, attrs){
            $(element[0]).autocomplete({
                source: function(request, response) {
                    $.ajax({
                        'type': 'GET',
                        'url': scope.source + request.term,
                        'cache': false,
                        'success': function(data){
                            response( $.map(data, function (item)
                            {
                                return {
                                    label: item.name,
                                    value: item.permalink
                                }
                            }));
                        }
                    });
                },
                minLength: scope.minlength,
                select: function( event, ui ) {
                    return false;
                },
                focus: function(event, ui){},
                open: function(event, ui){
                }
            }).data("uiAutocomplete")._renderItem = (function (ul, item) {
                return $("<li></li>")
                    .data("item.uiAutocomplete", item)
                    .append('<a href="#/x/' + item.value + '">' + item.label + "</a>")
                    .appendTo(ul);
            });
        }
    }
});

//normalize JSON structure
function normalizeCategoryResults(results){
    return {
        count: results.count,
        data: results.data
    }
}

function normalizeXResults(results){
    return {
        name: results.name,
        permalink: results.permalink,
        website: results.homepage_url,
        twitter: results.twitter_user,
        category: results.category_code,
        email: results.email_address,
        description: results.description,
        overview: results.overview,
        image: results.image[0].image,
        locations: results.offices,
        funding_rounds : results.funding_rounds,
        total : results.total_funding_raised,
        color : '#9D844F',
        radius : 200, // TODO: compute radius
        funding: {
            unit: "USD",
            total: results.total_founding_raised
        }
    }
}

//configure routes
wizualyApp.config(['$routeProvider', '$locationProvider',
    function ($routeProvider, $locationProvider) {
        $routeProvider.
            when('/', {
                templateUrl: 'partials/index.html'
            }).
            when('/x/:permalink', {
                templateUrl: 'partials/x.html'
            }).
            when('/y/:permalink', {
                templateUrl: 'partials/y.html'
            }).
            when('/z/:permalink', {
                templateUrl: 'partials/z.html'
            }).
            otherwise({
                redirectTo: '/'
            });

        //$locationProvider.html5Mode(Modernizr.history ? true : false);
    }
]).run(function(Data, $http, $rootScope){
    $http({
        'method': 'GET',
        'url': 'data/categories.json'
    }).success(
        function(data, status, headers, config){
            Data.categories = data;
        }
    ).error(
        function(data, status, headers, config){
        }
    );
});

/******************************************************************/
//data
wizualyApp.factory('Data', function(){
    return {
        results: {}
    };
});

/******************************************************************/
//categories
wizualyApp.controller('CategoryController', ['$scope', 'Data', '$http', function($scope, Data, $http){
    //store categories
    $scope.categories = Data.categories;
    $scope.results = {};

    $scope.catColor = function(category){
        return {
            background: category.color
        }
    };

    //get results
    $scope.getCategoryResults = function(){
        console.log('[DEBUG] showCategoryResults');
        var permalink = this.category.permalink;

        if(!$scope.results[permalink]) {
            $http({
                'method': 'GET',
                'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/categories/su/' + permalink + '/50'
            }).success(
                function(data, status, headers, config){
                    $scope.results[permalink] = data;
                }
            ).error(
                function(data, status, headers, config){
                    console.log('error occured when downloading ' + permalink);
                }
            );
        }
    };
}]);

//entity controller
wizualyApp.controller('XController', ['$scope', 'Data', '$http', function($scope, Data, $http){
    //get entity data
    $scope.getEntityData = function(permalink){
        $http({
            'method': 'GET',
            'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/relations/su/' + permalink
        }).success(
            function(data, status, headers, config){
                console.log('data: ', data);

                $scope.x = normalizeXResults(data);

                console.log('data-normalized: ', $scope.x);
            }
        ).error(
            function(data, status, headers, config){
            }
        );
    };

    //get entity data when the route has changed
    $scope.$on('$routeChangeSuccess', function(scope, next, current){
        if(next.templateUrl === 'partials/x.html') {
            $scope.getEntityData(next.params.permalink);
        }
    });
}]);

//search controller
wizualyApp.controller('SearchController', ['$scope', function($scope){
}]);