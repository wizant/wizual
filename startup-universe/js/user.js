var API = {
    // root: API_BASE_PATH + "/api/v3/",
    root: API_BASE_PATH + "/",
    pathSearch: {
        vc: "name/3p/",
        su: "name/case/",
        pe: "name/law/"
    },
    pathCounts: "stats/count",
    pathCategories: "categories/case/",
    retryLimit: 3,
    pathRelations: {
        vc: "relations/3p/",
        su: "relations/case/",
        pe: "relations/law/"
    },
    lastRelationsData: {
        target: null,
        permalink: null,
        result: null
    },
    getPath: function (method, target) {
        var methodPaths = {
            show: "pathRelations",
            search: "pathSearch"
        };
        var path = methodPaths[method];
        return this.root + this[path][target]
    },
    normalizeStartup: function (startup) {
        startup.founded_date = dateparts2time(startup, "founded");
        startup.category_code = startup.category_code || "null";
        startup.twitter_username || (startup.twitter_username = "");
        startup.image_url = _.min(startup.image, function (image) {
            return image.h
        });
        if (startup.image_url) {
            startup.image_url = startup.image_url.image
        }
        startup.officeString = _.map(startup.offices, function (o) {
            return _.without([o.city, o.state_code || o.country_code], undefined).join(", ")
        }).join("; ")
    },
    prepareStartups: function (startups) {
        _.each(startups, function (startup) {
            _.each(startup.funding_rounds, function (round) {
                round.funded_date = dateparts2time(round, "funded")
            });
            startup.funding_rounds = _.sortBy(startup.funding_rounds, "funded_date");
            startup.round_dates = _.pluck(startup.funding_rounds, "funded_date");
            startup.sum = _.reduce(startup.funding_rounds, function (sum, round) {
                return sum + round.raised_amount
            }, 0) || 0;
            var running_totals = 0;
            startup.running_totals = _.map(startup.funding_rounds, function (round) {
                running_totals += round.raised_amount;
                return running_totals
            });
            this.normalizeStartup(startup)
        }, this)
    },
    setInvestedRounds: function (permalink, startups) {
        _(startups).each(function (startup) {
            var invested_rounds = [];
            _(startup.funding_rounds).each(function (round, i) {
                var invested = _.any(round.investors, function (investor) {
                    return investor.permalink === permalink
                });
                if (invested) {
                    invested_rounds.push(i)
                }
            });
            startup.invested_rounds = invested_rounds
        })
    },
    getParentObject: function (target, permalink, data) {
        var list;
        if (target === "vc") {
            list = _(data).pluck("funding_rounds").flatten().pluck("investors").flatten().value()
        } else if (target === "pe") {
            list = _(data).pluck("people").flatten().value()
        }
        return _.find(list, function (item) {
            return item.permalink === permalink
        })
    },
    findStoredStartup: function (permalink) {
        return _.find(this.lastRelationsData.result && this.lastRelationsData.result.startups, function (startup) {
            return startup.permalink === permalink
        })
    },
    addImageUrl: function (object) {
        if (object.image_url) return;
        if (object.image[0]) {
            object.image_url = object.image[0].image
        } else {
            object.image_url = ""
        }
    },
    send: function (path, callback, tryCount) {
        $.getJSON(this.root + path, callback).fail(function () {
            if (tryCount == null) {
                tryCount = 0
            }
            tryCount++;
            if (tryCount < API.retryLimit) {
                API.send(path, callback, tryCount)
            } else {
                callback(null)
            }
        })
    },
    categories: function (category, count, callback) {
        this.send(this.pathCategories + category + "/" + count, callback)
    },
    counts: function (callback) {
        this.send(this.pathCounts, callback)
    },
    search: function (target, string, callback) {
        this.send(this.pathSearch[target] + string, callback)
    },
    relations: function (target, permalink, callback) {
        var self = this;

        console.log('[API] target: ', target, ', permalink: ', permalink, ', callback: ', callback);

        function onLoad(data) {
            if (data) {
                var startups = target === "su" ? [data] : data.startups;
                self.prepareStartups(startups);
                if (target !== "su") {
                    var parentObject = self.getParentObject(target, permalink, startups);
                    if (target === "vc") {
                        self.setInvestedRounds(parentObject.permalink, startups)
                    }
                    _.extend(data, parentObject);
                    self.addImageUrl(data)
                }
                self.lastRelationsData = {
                    target: target,
                    permalink: permalink,
                    result: data
                }
            }
            callback(data)
        }
        if (this.lastRelationsData.target === target && this.lastRelationsData.permalink === permalink) {
            callback(this.lastRelationsData.result);
            return
        }
        if (target === "su") {
            var storedStartup = this.findStoredStartup(permalink);
            if (storedStartup) {
                callback(storedStartup);
                return
            }
        }
        this.send(this.pathRelations[target] + permalink, onLoad)
    }
};
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
    makeCategory("advertising", "Lysol", "#e1b375");
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
$(function () {
    relationships.init()
});
(function ($) {
    var defaults = {
        format: function (value) {
            return value
        }
    };
    var methods = {
        init: function (options) {
            var opts = $.extend({}, defaults, options);
            opts.change = function (eventName) {
                functions.updateValues(this);
                options.change && options.change.call(this, eventName)
            };
            this.noUiSlider("init", opts);
            this.find(".noUi-handle div").append('<span class="slider-value">');
            this.each(function () {
                functions.updateValues($(this))
            });
            return this
        },
        toggleHandles: function (visible) {
            this.find(".noUi-handle").toggle(visible);
            return this
        }
    };
    var functions = {
        updateValues: function (slider) {
            var values = slider.noUiSlider("value"),
                format = functions.getOptions(slider).format;
            slider.find(".noUi-lowerHandle .slider-value").html(format(values[0]));
            slider.find(".noUi-upperHandle .slider-value").html(format(values[1]))
        },
        getOptions: function (slider) {
            return slider.data("api").options
        }
    };
    $.fn.noUiSliderMod = function (method, options) {
        if (method in methods) {
            return methods[method].call(this, options)
        } else {
            return this.noUiSlider(method, options)
        }
    }
})(jQuery);
(function () {
    var method;
    var noop = function () {};
    var methods = ["assert", "clear", "count", "debug", "dir", "dirxml", "error", "exception", "group", "groupCollapsed", "groupEnd", "info", "log", "markTimeline", "profile", "profileEnd", "table", "time", "timeEnd", "timeStamp", "trace", "warn"];
    var length = methods.length;
    var console = window.console = window.console || {};
    while (length--) {
        method = methods[length];
        if (!console[method]) {
            console[method] = noop
        }
    }
})();
var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function isMobile() {
    var agent = navigator.userAgent || navigator.vendor || window.opera;
    return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(agent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(agent.substr(0, 4))
}
var Events = {
    on: function (name, callback, context) {
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
ko.underscoreTemplateEngine = function () {};
ko.underscoreTemplateEngine.prototype = ko.utils.extend(new ko.templateEngine, {
    renderTemplateSource: function (templateSource, bindingContext, options) {
        var precompiled = templateSource["data"]("precompiled");
        if (!precompiled) {
            precompiled = _.template("<% with($data) { %> " + templateSource.text() + " <% } %>");
            templateSource["data"]("precompiled", precompiled)
        }
        var renderedMarkup = precompiled(bindingContext).replace(/\s+/g, " ");
        return ko.utils.parseHtmlFragment(renderedMarkup)
    },
    createJavaScriptEvaluatorBlock: function (script) {
        return "<%= " + script + " %>"
    }
});
ko.setTemplateEngine(new ko.underscoreTemplateEngine);
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
        return $(selector, this.element)
    },
    init: function () {
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
        // tutorial.init();
        if (isMobile()) {
            this.showSuConnectionsDeferred = _.throttle(this.showSuConnections, 100)
        }
        window.deferRelationships.resolve()
    },
    initViewModel: function () {
        var self = this;
        this.viewModel = {
            viewMode: ko.observable(this.MODE_SHOW_SU),
            totals: {},
            vcRelated: ko.observable([]),
            peRelated: ko.observable([]),
            selectedVC: ko.observable(null),
            selectedPE: ko.observable(null),
            activeVC: ko.observable(null),
            activeSU: ko.observable(null),
            activePE: ko.observable(null),
            loading: ko.observable(false),
            scalePosition: ko.observable(),
            scaleWidth: ko.observable(),
            scaleFormatted: ko.observable(),
            scaleRoundInfo: ko.observable(""),
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
                this.isAboutPage(true);
                self.toggleAboutPage(true)
            },
            hideAboutPage: function () {
                var vm = self.viewModel;
                self.toggleAboutPage(false, _.bind(vm.isAboutPage, vm, false))
            },
            startTutorial: function () {
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
        this.viewModel.timePoint.subscribe(function() { console.log('timePoint changed'); });
        
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
        var self = this;
        this.$(".list-vc").on("mouseover", ".item", this.onVcMouseover);
        this.$(".list-vc").on("mouseout", ".item", _.bind(this.painter.hideVcConnections, this.painter));
        this.$(".column1 .list-container").on("jsp-scroll-y", function () {
            console.log('jsp-scroll-y');
            if (self.viewModel.viewMode() == self.MODE_SHOW_SU) {
                self.showSuConnectionsDeferred()
            }
        });
        this.$(".categories").on("mouseenter", ".inner", function (event) {
            console.log('mouseenter');
            self.$('.search-widget input[type="text"]').blur();
            self.toggleHomeCategory(true, event)
        });
        this.$(".categories").mouseleave(function () {
            console.log('mouseleave');
            self.categoriesHideTimeout = setTimeout(_.bind(self.toggleHomeCategory, self, false), 400)
        });
        this.$(".categories").mouseenter(function () {
            console.log('mouseenter');
            clearTimeout(self.categoriesHideTimeout)
        });
        this.$(".categories .tooltip").on("click", ".tooltip-item", function (e) {
            console.log('click');
            var permalink = $(e.currentTarget).data("permalink");
            self.toggleHomeCategory(false);
            self.show("su", permalink)
        });
        $(window).on("resize", _.debounce(_.bind(this.resize, this, true), 200))
    },
    initHistory: function () {
        console.log('initHistory state: ', state);
        
        var self = this;
        var state = this.getState();
        this.pushState(state.mode, state.target, state.data, true);
        console.log('initHistory state: ', state);
        this.applyState(state);
        $(window).on("statechange", function () {
            console.log('windows on.statechange: ', self.getState() );
            self.applyState(self.getState())
        })
    },
    initPainter: function () {
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
        var self = this;

        function initAutocomplete(target) {
            var input = self.$(".column-" + target).find('.search-widget input[type="text"]');
            input.autocomplete(API.getPath("search", target), {
                queryParamName: false,
                remoteDataType: "json",
                maxItemsToShow: 0,
                selectFirst: true,
                processData: function (data) {
                    return _.map(data, function (item) {
                        return {
                            value: item.name,
                            data: item
                        }
                    })
                },
                onItemSelect: function (obj, widget) {
                    var item = obj.data;
                    self.show(target, item.permalink);
                    widget.setValue("")
                },
                onShow: function (dummy, widget) {
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
        console.log('getState');
        var historyState = History.getState(),
            state = historyState.data;

        console.log('getState state: ', state);
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

            console.log('base: ', base, ', path: ', path, ', parsed: ', parsed);
        }
        if (!state.mode) {
            state = {}
        }
        return state
    },
    applyState: function (state) {
        console.log('applyState');
        if (state.mode === "show") {
            this.doShow(state.target, state.data)
        } else {
            this.viewModel.viewMode(this.MODE_HOME)
        }
    },
    pushState: function (mode, target, data, replace) {
        console.log('pushState');
        var url = mode ? [mode, target, data].join("/") : ".";
        History[replace ? "replaceState" : "pushState"]({
            mode: mode,
            target: target,
            data: data
        }, null, url)
    },
    setViewMode: function (action, target) {
        var modeName = ("mode_" + action + "_" + target).toLocaleUpperCase();
        this.viewModel.viewMode(this[modeName])
    },
    resize: function (needRepaint) {
        console.log('resize');
        var headerHeight = this.$(".content").position().top,
            footerHeight = this.$(".footer").outerHeight(true),
            contentHeight = this.element.height() - headerHeight - footerHeight;
        this.$(".content").height(contentHeight);
        if (needRepaint) {
            console.log('[relationships resize] needRepaint');

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
        if (!permalink) return;
        this.pushState("show", target, permalink)
    },
    doShow: function (target, permalink) {
        console.log('doShow');
        if (!permalink) return;
        var self = this,
            methods = {
                vc: this.showVC,
                su: this.showSU,
                pe: this.showPE
            };
        var callback = function (item) {
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
        console.log('[relationships showVC]');

        this.currentStartups = investor && investor.startups || [];
        this.drawStartups();
        this.viewModel.vcRelated(investor ? [
            [investor]
        ] : [
            []
        ])
    },
    showSU: function (startup) {
        console.log('[relationships showSU]');

        this.currentStartups = startup ? [startup] : [];
        this.drawStartups()
    },
    showPE: function (founder) {
        console.log('[relationships showPE]');

        this.currentStartups = founder && founder.startups;
        this.drawStartups();
        this.viewModel.peRelated(founder ? [
            [founder]
        ] : [
            []
        ])
    },
    clearSVG: function () {
        this.painter && this.painter.clear()
    },
    getBubblesArea: function () {
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
        return x + this.painter.left
    },
    absolute2Chart: function (point) {
        var chartOffset = this.svg.parent().offset();
        return {
            x: point.x - chartOffset.left,
            y: point.y - chartOffset.top
        }
    },
    getStartupFounders: function (startup) {
        return _.sortBy(startup && startup.people, "name")
    },
    getStartupInvestorsByRound: function (startup) {
        return _.map(startup && startup.funding_rounds, function (round) {
            return _.sortBy(round.investors, "name")
        })
    },
    getStartupInvestors: function (startup) {
        return _(startup && startup.funding_rounds).pluck("investors").flatten().uniq(function (investor) {
            return investor.permalink
        }).sortBy("name").value()
    },
    updateRelationships: function () {
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
        this.viewModel.scalePosition(-100);
        this.viewModel.scaleWidth("5em");
        this.viewModel.scaleFormatted("");
        this.viewModel.scaleRoundInfo("")
    },
    animate: function (el, attrs) {
        if (Modernizr.csstransitions) {
            el.css(attrs)
        } else {
            el.stop(true, false).animate(attrs)
        }
    },
    animateScalePosition: function () {
        var el = this.$(".arrow-scale-floater"),
            width = el.width(),
            centerX = this.viewModel.scalePosition(),
            left = centerX - width / 2;
        this.animate(el, {
            left: left
        })
    },
    animateScaleWidth: function () {
        this.animate(this.$(".arrow-scale-outer"), {
            width: this.viewModel.scaleWidth()
        })
    },
    updateLegendCategories: function () {
        var activeCategories = _.isEmpty(this.currentStartups) ? [] : _(this.painter.getRenderedStartups()).pluck("category_code").uniq().value();
        _(this.viewModel.legendCategories).each(function (cat) {
            cat.inactive(!_.contains(activeCategories, cat.id))
        })
    },
    calculateYearWidth: function (minDate, maxDate) {
        var years = (maxDate - minDate) / (1e3 * 60 * 60 * 24 * 365.25);
        return this.axisWidth / years
    },
    getAxisDashArray: function (yearWidth, date1, date2) {
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
        this.axisWidth = this.$(".axis-chart").width();
        this.yearWidthTotal = this.calculateYearWidth(minDate, maxDate);
        var dashArray = this.getAxisDashArray(this.yearWidthTotal, minDate, maxDate);
        d3.select(this.$(".axis-total .segment1")[0]).style("stroke-dasharray", dashArray)
    },
    updateTimeAxis: function () {
        console.log('[relationships updateTimeAxis]');
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
        console.log('[relationships drawStartups]');
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
        this.viewModel.sliderVisible(false);
        this.painter.setArea(this.getBubblesArea());
        this.painter.drawSingleStartup(startup)
    },
    drawMultipleStartups: function (startups) {
        console.log('[relationships drawMultipleStartups]');
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
        this.$(".content .scrollable").each(function () {
            var api = $(this).data("jsp");
            api && _.defer(_.bind(api.reinitialise, api))
        })
    },
    getVcConnectionPoint: function ($el) {
        $el = $($el);
        var offset = $el.offset();
        return this.absolute2Chart({
            x: offset.left + $el.width() + 10,
            y: offset.top + $el.height() / 2
        })
    },
    getPeConnectionPoint: function ($el) {
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

        console.log('[relationships onVcMouseover] permalink: ', permalink, ', point: ', point);
        this.painter.showVcConnections(permalink, point)
    },
    showSuConnections: function () {
        var startup = this.viewModel.activeSU();
        if (!startup) return;
        var vcPointsByRound = _.map(this.$(".list-vc .list-content"), function (list, i) {
            return _.map($(".item", list), this.getVcConnectionPoint)
        }, this);
        var pePoints = _.map(this.$(".list-pe .item"), this.getPeConnectionPoint);
        this.painter.showSuConnections(startup.permalink, vcPointsByRound, pePoints)
    },
    showSuConnectionsDeferred: function () {
        console.log('[relationships showSuConnectionsDeferred]');
        _.defer(this.showSuConnections)
    },
    showRoundDetails: function (startup, roundIndex) {
        this.updateScaleLegend(startup, roundIndex)
    },
    hideRoundDetails: function () {
        this.updateScaleLegend()
    },
    highlightStartup: function (startup) {
        this.painter.highlightStartup(startup);
        this.viewModel.peRelated([this.getStartupFounders(startup)]);
        this.viewModel.vcRelated(this.getStartupInvestorsByRound(startup));
        this.updateScrollbars()
    },
    dehighlightStartup: function () {
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
        var vm = this.viewModel;
        vm.selectedVC(null);
        vm.activeSU(null);
        vm.selectedPE(null);
        this.currentStartups = [];
        this.resetScaleLegend();
        this.updateLegendCategories()
    },
    updateHomeModeLayout: function () {
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
        searchBlock.find(".column3").animate({
            right: col3Right
        })
    },
    toggleHomeCategory: function (visible, event) {
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
        // tutorial.start(this.endTutorial)
    },
    endTutorial: function () {
        // this.viewModel.hideAboutPage();
        // this.pushState();
        // this.toggleHomeCategory(false)
    },
    getCurrentObject: function () {
        return this.viewModel.activeObject()
    },
    formatShareCount: function (count) {
        if (count < 1e3) return "" + count;
        if (count < 1e5) return (count / 1e3).toFixed(1) + "k";
        if (count < 1e6) return (count / 1e3).toFixed(0) + "k";
        if (count < 1e8) return (count / 1e6).toFixed(1) + "M"
    },
    getShareText: function (mode, data) {
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
        return History.getState().cleanUrl
    },
    getShareTitle: function () {
        return "The Startup Universe"
    },
    getShareImage: function () {
        return $('head meta[property="og:image"]').attr("content")
    },
    updateTwitterButton: function () {
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
_.bindAll(relationships);
_.extend(relationships, Events);
var Painter = function (chart) {
    this.chart = chart;
    this.renderQueue = []
};
_.extend(Painter.prototype, Events);
Painter.prototype.BUBBLE_PADDING = 2;
Painter.prototype.TITLE_HEIGHT = 20;
Painter.prototype.CHART_MARGIN_RELATIVE = .14;
Painter.prototype.CHART_MARGIN_BOTTOM = 32;
Painter.prototype.MIN_BUBBLE_RADIUS = 2;
Painter.prototype.MAX_BUBBLE_SIZE_RELATIVE = .8;
Painter.prototype.clear = function () {
    $(this.chart.node()).empty();
    this.initGradients();
    this.bubbles = {};
    this.bubbleDates = {};
    this.chart.append("g").attr("class", "bubbles");
    this.chart.append("g").attr("class", "connections");
    this.chart.append("g").attr("class", "bubble-outers")
};
Painter.prototype.setArea = function (area) {
    _.extend(this, area);
    this.chartMargin = this.width * this.CHART_MARGIN_RELATIVE;
    this.left += this.chartMargin;
    this.width -= this.chartMargin * 2;
    this.top += this.TITLE_HEIGHT;
    this.height -= this.TITLE_HEIGHT
};
Painter.prototype.setStartups = function (startups) {
    this.allStartups = startups
};
Painter.prototype.getRenderedStartups = function () {
    return this.renderedStartups
};
Painter.prototype.getScale = function () {
    return this.scale
};
Painter.prototype.setStartupView = function (isStartupView) {
    this.startupView = isStartupView
};
Painter.prototype.drawSingleStartup = function (startup) {
    console.log('[Painter drawSingleStartup]');
    var originalDate = startup.date;
    if (!startup.date) {
        startup.date = Date.now()
    }
    this.minDate = startup.date - 1e3;
    this.maxDate = startup.date + 1e3;
    this.filteredStartups = [startup];
    this.pack();
    startup.date = originalDate;
    this.drawPacked()
};
Painter.prototype.drawDateRange = function (minDate, maxDate) {
    console.log('[Painter drawDateRange]');
    this.minDate = minDate;
    this.maxDate = maxDate;
    this.filteredStartups = _.filter(this.allStartups, function (s) {
        return s.date >= minDate && s.date <= maxDate
    });
    this.pack();
    this.drawPacked()
};
Painter.prototype.initGradients = function () {
    var defs = this.chart.append("svg:defs");
    _(Categories).each(function (cat) {
        var id = this.getGradientId(cat.id),
            color1 = cat.color,
            color2 = d3.rgb(color1).darker(.6);
        this.chart.select("defs").append("svg:linearGradient").attr("id", id).attr("spreadMethod", "pad").attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%").call(function (gradient) {
            gradient.append("svg:stop").attr("offset", "0%").style("stop-color", color2);
            gradient.append("svg:stop").attr("offset", "40%").style("stop-color", color1)
        })
    }, this)
};
Painter.prototype.getGradientId = function (category) {
    return "gradient-" + category
};
Painter.prototype.getGradientUrl = function (category) {
    var path = location.pathname.replace(BASE_PATH, "");
    console.log('[Prototype getGradientUrl] category: ', category, ', BASE_PATH: ', BASE_PATH, ', path: ', path);
    return path + "#" + this.getGradientId(category)
};
Painter.prototype.createXScale = function () {
    var padding = 84600;
    return d3.scale.linear().domain([this.minDate - padding, this.maxDate + padding]).range([0, this.width])
};
Painter.prototype.getTitleBBox = function (startup) {
    var text = this.chart.append("svg:text").text("11." + startup.name).attr("text-anchor", "middle").attr("x", startup.x).attr("y", 0).style("fill", "transparent");
    var bbox = text.node().getBBox();
    text.remove();
    return bbox
};
Painter.prototype.getTitleHeight = function (startup) {
    return startup.showTitle ? this.TITLE_HEIGHT : 0
};
Painter.prototype.getMinMaxScales = function () {
    var maxSum = _.max(this.startups, function (s) {
        return s.sum
    }).sum;
    var xScale = this.createXScale();
    var maxBubbleScale = maxSum / (this.BUBBLE_PADDING + this.MIN_BUBBLE_RADIUS) * 2,
        maxBubbleRadius = Math.min(this.height, this.width) * this.MAX_BUBBLE_SIZE_RELATIVE / 2 - this.BUBBLE_PADDING,
        individualScales = _.map(this.startups, function (s) {
            var x = xScale(s.date);
            return (s.sum || 1) / Math.max(Math.min(x, this.width - x), this.chartMargin)
        }, this),
        minBubbleScale = Math.max(_.max(individualScales), maxSum / maxBubbleRadius);
    return {
        min: Math.ceil(minBubbleScale),
        max: Math.ceil(maxBubbleScale)
    }
};
Painter.prototype.getPackedPositions = function (bubbleScale) {
    var levels = [
        [0, 0],
        [this.height - this.CHART_MARGIN_BOTTOM, -this.chartMargin - this.BUBBLE_PADDING]
    ];
    var updateLevels = function (start, height, filledWidth) {
        var end = start + height,
            getLevelEnd = function (level) {
                return level[0]
            }, startIndex = _.sortedIndex(levels, [start], getLevelEnd),
            endIndex = _.sortedIndex(levels, [end], getLevelEnd),
            prevLevel = levels[startIndex],
            newLevel1 = [start, prevLevel && prevLevel[1]],
            newLevel2 = [end, filledWidth];
        levels.splice(startIndex, endIndex - startIndex, newLevel1, newLevel2)
    };
    var positions = _.map(this.startups, function (s) {
        var TITLE = 1,
            BUBBLE = 2,
            blockPart = TITLE,
            titleHeight = this.getTitleHeight(s),
            bubbleRadius = Math.max(s.sum / bubbleScale, this.MIN_BUBBLE_RADIUS),
            blockHeight = bubbleRadius * 2 + this.BUBBLE_PADDING + titleHeight,
            blockWidth = (bubbleRadius + this.BUBBLE_PADDING) * 2,
            blockLeft = s.x - bubbleRadius - this.BUBBLE_PADDING,
            title = s.showTitle ? this.getTitleBBox(s) : {
                x: blockLeft,
                width: 0
            }, spareSpaceStart, y;
        for (var i = 1, len = levels.length; i < len; ++i) {
            var level = levels[i],
                levelEnd = level[0],
                filledWidth = level[1],
                prevLevelEnd = levels[i - 1][0];
            if (blockPart === TITLE && title.x > filledWidth) {
                if (spareSpaceStart == null) {
                    spareSpaceStart = prevLevelEnd
                }
                if (levelEnd - spareSpaceStart >= titleHeight) {
                    blockPart = BUBBLE
                }
            }
            if (blockPart === BUBBLE && blockLeft > filledWidth) {
                if (levelEnd - spareSpaceStart >= blockHeight) {
                    titleHeight && updateLevels(spareSpaceStart, titleHeight, title.x + title.width);
                    updateLevels(spareSpaceStart + titleHeight, blockHeight - titleHeight, blockLeft + blockWidth);
                    y = spareSpaceStart + bubbleRadius + titleHeight;
                    break
                }
            } else {
                spareSpaceStart = null;
                blockPart = TITLE
            }
        }
        return y
    }, this);
    return positions
};
Painter.prototype.centerVertical = function () {
    function getBubbleTop(s) {
        return s.y - s.radius - self.getTitleHeight(s)
    }

    function getBubbleBottom(s) {
        return s.y + s.radius + self.BUBBLE_PADDING
    }
    var self = this,
        minBubbleTop = _(this.startups).map(getBubbleTop).min().value(),
        maxBubbleBottom = _(this.startups).map(getBubbleBottom).max().value(),
        stretchFactor = (this.height - this.CHART_MARGIN_BOTTOM) / (maxBubbleBottom - minBubbleTop);
    _.each(this.startups, function (s) {
        var top = getBubbleTop(s),
            bottom = getBubbleBottom(s),
            newTop = (top - minBubbleTop) * stretchFactor;
        s.y = newTop + s.radius + self.getTitleHeight(s)
    })
};
Painter.prototype.packWithBestScale = function () {
    function isPackingValid(positions) {
        return _.every(positions, function (pos) {
            return pos != null
        })
    }
    var scales = this.getMinMaxScales(),
        minBubbleScale = scales.min,
        maxBubbleScale = Math.max(scales.max, scales.min);
    var MAX_ATTEMPTS = 10,
        scale, positions, isValid, lastGood, lastBadScale;
    scale = maxBubbleScale;
    for (var i = 0; i < MAX_ATTEMPTS; i++) {
        positions = this.getPackedPositions(scale);
        if (isPackingValid(positions)) {
            lastGood = {
                scale: scale,
                positions: positions
            };
            if (scale <= minBubbleScale * 1.2) break;
            if (lastBadScale == null) {
                scale = minBubbleScale
            } else {
                scale = (lastBadScale + scale) / 2
            }
        } else {
            if (scale >= maxBubbleScale / 1.2) break;
            lastBadScale = scale;
            scale = (lastBadScale + lastGood.scale) / 2
        }
    }
    return lastGood
};
Painter.prototype.packPossibleTitlesCount = function (startups) {
    var attempts = 3,
        len = startups.length,
        maxCount = Math.min(len, 30),
        minCount = 6,
        countScale = d3.scale.linear().domain([0, attempts - 1]).range([maxCount, minCount]),
        bestPackData;
    for (var i = 0; i < attempts; i++) {
        var count = Math.floor(countScale(i));
        this.startups = _(startups).sortBy("sum").each(function (s, i) {
            s.showTitle = len - i <= count
        }).sortBy("date").value();
        bestPackData = this.packWithBestScale();
        if (bestPackData) break
    }
    return bestPackData
};
Painter.prototype.packPossibleCount = function () {
    function getGroupId(startup) {
        var dt = new Date(startup.date);
        return dt.getFullYear() * 100 + dt.getMonth()
    }
    console.log('[Painter packPossibleCount] this.filteredStartups: ', this.filteredStartups);
    console.log('[Painter packPossibleCount] this.filteredStartups.groupBy(): ', _(this.filteredStartups).groupBy(getGroupId));
    var attempts = 4,
        len = this.filteredStartups.length,
        maxCountPerGroup = _(this.filteredStartups).groupBy(getGroupId).map(function (group) {
            return group.length
        }).max().value(),
        step = Math.ceil(maxCountPerGroup / (attempts - 1)),
        bestPackData;
    for (var i = 0; i < attempts; i++) {
        var count = Math.max(maxCountPerGroup - step * i, 0);
        var startups = _(this.filteredStartups).groupBy(getGroupId).map(function (group) {
            return _(group).sortBy("sum").last(count).value()
        }).flatten().sortBy("date").value();
        bestPackData = this.packPossibleTitlesCount(startups);
        if (bestPackData) break
    }
    return bestPackData
};
Painter.prototype.pack = function () {
    var bestPackData, xScale = this.createXScale();
    _.each(this.filteredStartups, function (s) {
        s.x = xScale(s.date)
    });
    bestPackData = this.packPossibleCount();
    if (!bestPackData) {
        this.scale = 0;
        this.startups = [];
        return
    }
    this.scale = bestPackData.scale;
    _.each(this.startups, function (s, index) {
        s.y = bestPackData.positions[index];
        s.radius = Math.max(s.sum / bestPackData.scale, this.MIN_BUBBLE_RADIUS);
        s.index = index;
        var realScale = (s.sum || 1) / s.radius;
        s.round_radiuses = _.map(s.running_totals, function (sum, index) {
            var radius = sum / realScale;
            if (index === s.running_totals.length - 1 && !sum) {
                radius = this.MIN_BUBBLE_RADIUS
            }
            return s.radius > 10 ? radius : 0
        }, this);
        if (_.isEmpty(s.round_radiuses)) {
            s.round_radiuses = [this.MIN_BUBBLE_RADIUS]
        }
    }, this);
    this.centerVertical()
};
Painter.prototype.showVcConnections = function (permalink, point) {
    var self = this,
        x = point.x,
        y = point.y;
    this.runWhenRendered(function () {
        this.chart.selectAll(".link-vc").remove();
        var minStartupX = _(this.startups).pluck("x").min().value() + this.left;
        var curveXScale = d3.scale.linear().domain([self.height, 0]).range([(x + minStartupX) / 2, minStartupX]);
        var data = _(this.startups).map(function (startup) {
            return _(startup.round_radiuses).filter(function (r, i) {
                var round = startup.funding_rounds[i];
                return round && _.any(round.investors, function (vc) {
                    return vc.permalink === permalink
                })
            }).map(function (r) {
                return {
                    x: startup.x,
                    y: startup.y + r
                }
            }).value()
        }).flatten().value();
        this.chart.select(".connections").selectAll(".link-vc").data(data).enter().append("g").attr("class", "link-vc").each(function (d) {
            var node = d3.select(this);
            var x2 = d.x + self.left,
                y2 = Math.floor(d.y + self.top) + .5,
                curveX = curveXScale(Math.abs(y2 - y)),
                controlX = x + (curveX - x) / 3;
            node.append("line").attr("x1", x2).attr("y1", y2).attr("x2", curveX).attr("y2", y2);
            node.append("path").attr("d", "M" + x + "," + y + "C" + [controlX, y, x, y2, curveX, y2].join(",")).style("fill", "transparent")
        })
    })
};
Painter.prototype.hideVcConnections = function () {
    console.log('[Painter hideVcConnections]');

    this.runWhenRendered(function () {
        this.chart.selectAll(".link-vc").remove()
    })
};
Painter.prototype.showSuVcConnections = function (startup, vcPointsByRound) {
    var self = this;
    var vcData = _(startup.round_radiuses).map(function (r, i) {
        var vcPoints = vcPointsByRound[i];
        if (!vcPoints) return null;
        return _.map(vcPoints, function (vcPoint) {
            return {
                x1: vcPoint.x,
                y1: Math.floor(vcPoint.y) + .5,
                x2: startup.x + self.left,
                y2: Math.floor(startup.y + r + self.top) + .5
            }
        })
    }).flatten().without(null).value();
    this.chart.select(".connections").selectAll(".link-su-vc").data(vcData).enter().append("g").attr("class", "link-su link-su-vc").each(function (d) {
        var node = d3.select(this);
        var x1 = d.x1,
            y1 = d.y1,
            x2 = d.x2,
            y2 = d.y2,
            curveX = (x2 + x1) / 2,
            controlX1 = x1 + (curveX - x1) / 5,
            controlX2 = x1 + (curveX - x1) / 2;
        node.append("line").attr("x1", x2).attr("y1", y2).attr("x2", curveX).attr("y2", y2);
        node.append("path").attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(",")).style("fill", "transparent")
    })
};
Painter.prototype.showSuPeConnections = function (startup, pePoints) {
    var self = this;
    var x2 = startup.x + this.left,
        y2 = Math.floor(startup.y + this.top) + .5;
    this.chart.select(".connections").selectAll(".link-su-pe").data(pePoints).enter().append("g").attr("class", "link-su link-su-pe").each(function (d) {
        var node = d3.select(this);
        var x1 = d.x,
            y1 = d.y,
            curveX = (x2 + x1) / 2,
            controlX1 = x1 + (curveX - x1) / 5,
            controlX2 = x1 + (curveX - x1) / 2;
        node.append("line").attr("x1", x2).attr("y1", y2).attr("x2", curveX).attr("y2", y2);
        node.append("path").attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(",")).style("fill", "transparent")
    })
};
Painter.prototype.showSuConnections = function (permalink, vcPointsByRound, pePoints) {
    this.runWhenRendered(function () {
        var startup = _.find(this.startups, function (s) {
            return s.permalink === permalink
        });
        this.chart.selectAll(".link-su").remove();
        this.showSuVcConnections(startup, vcPointsByRound);
        this.showSuPeConnections(startup, pePoints)
    })
};
Painter.prototype.hideSuConnections = function () {
    this.runWhenRendered(function () {
        this.chart.selectAll(".link-su").remove()
    })
};
Painter.prototype.startRender = function () {
    this.rendering = true
};
Painter.prototype.finishRender = function () {
    this.rendering = false;
    this.trigger("render");
    this.runPostRenderQueue()
};
Painter.prototype.runPostRenderQueue = function () {
    var copy = _.clone(this.renderQueue);
    this.renderQueue = [];
    _.each(copy, function (task) {
        task.call(this)
    }, this)
};
Painter.prototype.runWhenRendered = function (task) {
    if (this.rendering) {
        this.renderQueue.push(task)
    } else {
        task.call(this)
    }
};
Painter.prototype.drawPacked = function () {
    console.log('[Painter drawPacked]');
    this.clear();
    var self = this,
        dateBlocks = this.drawBubbleDates(),
        oldGrouped = _.groupBy(this.renderedStartups, "permalink"),
        newGrouped = _.groupBy(this.startups, "permalink");
    if (this.startups.length) {
        self.startRender()
    } else {
        self.finishRender()
    }
    var removed = _.reject(this.renderedStartups, function (s) {
        return s.permalink in newGrouped
    });
    var added = _.reject(this.startups, function (s) {
        return s.permalink in oldGrouped
    });
    var retained = _(this.startups).difference(added).each(function (s) {
        var oldStartup = oldGrouped[s.permalink][0];
        s.oldX = oldStartup.x;
        s.oldY = oldStartup.y;
        s.oldRadius = oldStartup.radius
    }).value();

    function getX(d) {
        return d.x + self.left
    }

    function getY(d) {
        return d.y + self.top
    }

    function getRadius(d) {
        return d.radius
    }

    function getColor(d) {
        return Categories[d.category_code].color
    }

    function showDateBlock(startup) {
        var dateBlock = dateBlocks[startup.permalink];
        if (!dateBlock) return;
        dateBlock.style("visibility", null)
    }

    function onEnd(d) {
        self.drawBubble(d);
        showDateBlock(d);
        d3.select(this).remove();
        var counter = onEnd.counter || 0;
        counter++;
        if (counter >= self.startups.length) {
            self.finishRender()
        }
        onEnd.counter = counter
    }
    this.chart.selectAll(".bubble-removed").data(removed).enter().append("circle").attr("cx", getX).attr("cy", getY).attr("r", getRadius).style("fill", getColor).transition().style("opacity", 0).remove();
    this.chart.selectAll(".bubble-added").data(added).enter().append("circle").attr("cx", getX).attr("cy", getY).attr("r", 0).style("fill", getColor).transition().attr("r", getRadius).each("end", onEnd);
    this.chart.selectAll(".bubble-retained").data(retained).enter().append("circle").attr("cx", function (d) {
        return d.oldX + self.left
    }).attr("cy", function (d) {
        return d.oldY + self.top
    }).attr("r", function (d) {
        return d.oldRadius
    }).style("fill", getColor).transition().attr("cx", getX).attr("cy", getY).attr("r", getRadius).each("end", onEnd);
    this.renderedStartups = _.map(this.startups, function (s) {
        return _.clone(s)
    })
};
Painter.prototype.drawBubble = function (startup) {
    console.log('[DEBUG] startup: ', startup);
    var self = this,
        g, titleHeight = this.getTitleHeight(startup),
        cx = startup.radius + this.BUBBLE_PADDING,
        cy = startup.radius + titleHeight,
        x = startup.x - cx + this.left,
        y = startup.y - cy + this.top,
        len = startup.round_radiuses.length,
        color = Categories[startup.category_code].color,
        strokeColor = d3.rgb(color).darker(1.5),
        textColor = color;
    g = this.chart.select(".bubbles")
            .append("g")
                .datum(startup)
                .attr("class", "bubble")
                .attr("width", (startup.radius + this.BUBBLE_PADDING) * 2)
                .attr("height", startup.radius * 2 + this.BUBBLE_PADDING + titleHeight)
                .attr("transform", "translate(" + x + "," + y + ")");

    g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", startup.radius)
        .attr("fill", "url(" + self.getGradientUrl(startup.category_code) + ")");
        
    var roundData = _.map(startup.funding_rounds, function (round, i) {
        return {
            radius: startup.round_radiuses[i],
            index: i
        }
    }).reverse();
    g.selectAll(".bubble-round")
        .data(roundData)
        .enter()
            .append("circle")
                .attr("class", "bubble-round")
                .attr("cx", cx).attr("cy", cy)
                .attr("r", function (d) { return d.radius })
                .style("stroke-width", 1.3)
                .style("stroke", strokeColor)
                .style("fill", "transparent")
                .each(function (d) {
                    if (self.startupView) {
                        $(this).hover(_.bind(self.trigger, self, "bubbleRound:mouseenter", startup, d.index), 
                                      _.bind(self.trigger, self, "bubbleRound:mouseleave", startup, d.index))
                    } else {
                        if (_.indexOf(startup.invested_rounds, d.index) !== -1) {
                            d3.select(this).style("stroke-width", 3)
                        }
                    }
                });

    var name = startup.name;
    if (this.startups.length > 1) {
        name = startup.index + 1 + "." + name
    }
    var nameElement = g.append("text").attr("class", "bubble-name bubble-clickable").classed("visible", !! titleHeight).text(name).attr("text-anchor", "middle").attr("x", cx).attr("y", titleHeight - 5).style("fill", textColor).on("click", function () {
        self.trigger("bubble:click", startup)
    });
    if (!this.startupView) {
        var outer = this.chart.select(".bubble-outers")
            .append("circle")
                .attr("class", "bubble-clickable")
                .attr("cx", startup.x + this.left)
                .attr("cy", startup.y + this.top)
                .attr("r", startup.radius)
                .style("opacity", 0)
                .on("click", function () {
                    self.trigger("bubble:click", startup)
                });

        var node = outer.node();
        $(node)
            .add(nameElement.node())
            .hover(_.bind(self.trigger, self, "bubble:mouseenter", startup), 
                   _.bind(self.trigger, self, "bubble:mouseleave", startup))
    }
    this.bubbles[startup.permalink] = g
};
Painter.prototype.drawBubbleDates = function () {
    function drawDate(startup) {
        var YEAR_HEIGHT = 15;
        var x = Math.floor(self.left + startup.x) + .5,
            y = self.top + self.height - 2;
        var g = self.chart.append("g").attr("class", "bubble-date-block").style("visibility", "hidden");
        var stringDayMonth = (startup.founded_day != null ? startup.founded_day + " " : "") + (startup.founded_month != null ? monthNames[startup.founded_month - 1] : "");
        var text = g.append("text").attr("class", "bubble-date").attr("text-anchor", "middle").attr("x", x).attr("y", y);
        text.append("tspan").attr("dy", -YEAR_HEIGHT).text(stringDayMonth);
        text.append("tspan").attr("class", "year").attr("x", x).attr("y", y).text(startup.founded_year);
        var top = text.node().getBBox().y || y;
        g.append("line").attr("x1", x).attr("y1", self.top + startup.y + startup.radius).attr("x2", x).attr("y2", top);
        return g
    }
    var self = this,
        startups = _.sortBy(this.startups, "sum").reverse(),
        displayedStartups = [],
        textWidth, dateBlocks = {};
    _.each(startups, function (startup) {
        var overlap = _.any(displayedStartups, function (s) {
            return Math.abs(s.x - startup.x) < textWidth
        });
        var dateBlock = drawDate(startup);
        if (!overlap && startup.showTitle) {
            displayedStartups.push(startup);
            dateBlock.classed("visible", true)
        }
        if (!textWidth) {
            textWidth = dateBlock.select("text").node().getBBox().width + 5
        }
        dateBlocks[startup.permalink] = dateBlock
    });
    this.bubbleDates = dateBlocks;
    return dateBlocks
};
Painter.prototype.highlightStartup = function (startup) {
    var permalink = startup.permalink,
        bubble = this.bubbles[permalink],
        bubbleDate = this.bubbleDates[permalink];
    bubble && bubble.classed("highlighted", true);
    bubbleDate && bubbleDate.classed("highlighted", true);
    _.each(this.bubbles, function (b) {
        if (b === bubble) return;
        b.transition().style("stroke-opacity", .1).style("fill-opacity", .1)
    });
    this.chart.classed("highlight-one", true)
};
Painter.prototype.dehighlight = function () {
    this.chart.classed("highlight-one", false);
    this.chart.selectAll(".highlighted").classed("highlighted", false);
    _.each(this.bubbles, function (b) {
        b.transition().style("stroke-opacity", 1).style("fill-opacity", 1)
    })
};
