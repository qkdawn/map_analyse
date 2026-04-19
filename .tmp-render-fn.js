const _Vue = Vue

return function render(_ctx, _cache) {
  with (_ctx) {
    const { createCommentVNode: _createCommentVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, createElementVNode: _createElementVNode, normalizeClass: _normalizeClass, vShow: _vShow, withDirectives: _withDirectives, renderList: _renderList, Fragment: _Fragment, createTextVNode: _createTextVNode, withKeys: _withKeys, vModelText: _vModelText, vModelSelect: _vModelSelect, withModifiers: _withModifiers, normalizeStyle: _normalizeStyle, vModelCheckbox: _vModelCheckbox } = _Vue

    return (_openBlock(), _createElementBlock(_Fragment, null, [
      _createTextVNode("﻿ "),
      _createCommentVNode(" Left Sidebar: Wizard Dashboard "),
      _createElementVNode("aside", {
        class: _normalizeClass(["sidebar", { 'is-step3-collapsed': sidebarView === 'wizard' && Number(step) === 2 && isStep3SidebarCollapsed }])
      }, [
        _createElementVNode("div", { class: "sidebar-header" }, [
          (sidebarView === 'wizard')
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "step-header-nav",
                style: {"margin":"0","width":"100%"}
              }, [
                (step === 1)
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "btn-text-back",
                      onClick: backToHome
                    }, "鈫?杩斿洖涓婚〉", 8 /* PROPS */, ["onClick"]))
                  : _createCommentVNode("v-if", true)
              ]))
            : _createCommentVNode("v-if", true),
          (sidebarView === 'history')
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "step-header-nav history-header-nav"
              }, [
                _createElementVNode("div", { class: "history-header-slot left" }, [
                  _createElementVNode("button", {
                    class: "btn-text-back",
                    onClick: $event => (backFromHistory()),
                    style: {"margin":"0"}
                  }, _toDisplayString(getHistoryBackButtonLabel()), 9 /* TEXT, PROPS */, ["onClick"])
                ]),
                _createElementVNode("h3", { class: "history-header-title" }, "鍘嗗彶璁板綍"),
                _createElementVNode("div", {
                  class: "history-header-slot right",
                  style: {"display":"flex","align-items":"center","justify-content":"flex-end","gap":"8px"}
                }, [
                  (!isSelectionMode)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: _normalizeClass(["btn-text-back history-icon-btn", { 'is-loading': historyLoading }]),
                        onClick: refreshHistoryList,
                        disabled: historyLoading,
                        style: {"margin":"0"},
                        title: "鍒锋柊鍘嗗彶璁板綍",
                        "aria-label": "鍒锋柊鍘嗗彶璁板綍"
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          viewBox: "0 0 24 24",
                          "aria-hidden": "true"
                        }, [
                          _createElementVNode("path", { d: "M20 5v5h-5" }),
                          _createElementVNode("path", { d: "M4 19v-5h5" }),
                          _createElementVNode("path", { d: "M6.2 8.2A8 8 0 0 1 18 10" }),
                          _createElementVNode("path", { d: "M17.8 15.8A8 8 0 0 1 6 14" })
                        ]))
                      ], 10 /* CLASS, PROPS */, ["onClick", "disabled"]))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("button", {
                    class: "btn-text-back",
                    onClick: $event => (toggleSelectionMode(!isSelectionMode)),
                    style: {"margin":"0"}
                  }, _toDisplayString(isSelectionMode ? '瀹屾垚' : '绠＄悊'), 9 /* TEXT, PROPS */, ["onClick"])
                ])
              ]))
            : _createCommentVNode("v-if", true)
        ]),
        _createElementVNode("div", { class: "sidebar-content" }, [
          _createCommentVNode(" Start Screen "),
          _withDirectives(_createElementVNode("div", { class: "home-menu" }, [
            _createElementVNode("div", {
              class: "home-card",
              onClick: $event => (confirmNavigation(() => resetAnalysis()))
            }, [
              _createElementVNode("div", { class: "home-icon" }, [
                _createElementVNode("img", {
                  src: "/static/images/search.svg",
                  alt: "鎺㈢储"
                })
              ]),
              _createElementVNode("div", { class: "home-text" }, [
                _createElementVNode("h3", null, "瀹炴椂鎺㈢储"),
                _createElementVNode("p", null, "Real-time Explore"),
                _createElementVNode("p", { style: {"margin-top":"4px","color":"#999"} }, "鍩轰簬楂樺痉瀹炴椂鏁版嵁鍒嗘瀽")
              ])
            ], 8 /* PROPS */, ["onClick"]),
            _createElementVNode("div", {
              class: "home-card",
              onClick: $event => (confirmNavigation(() => openHistoryView()))
            }, [
              _createElementVNode("div", { class: "home-icon" }, [
                _createElementVNode("img", {
                  src: "/static/images/history.svg",
                  alt: "妗ｆ"
                })
              ]),
              _createElementVNode("div", { class: "home-text" }, [
                _createElementVNode("h3", null, "鏈湴妗ｆ"),
                _createElementVNode("p", null, "Local Archives"),
                _createElementVNode("p", { style: {"margin-top":"4px","color":"#999"} }, "鏌ョ湅寰€鏈熷垎鏋愯褰? ")
              ])
            ], 8 /* PROPS */, ["onClick"])
          ], 512 /* NEED_PATCH */), [
            [_vShow, sidebarView === 'start']
          ]),
          _createCommentVNode(" History View "),
          _withDirectives(_createElementVNode("div", {
            class: "history-list",
            style: {"padding-bottom":"80px"}
          }, [
            (historyLoading && historyList.length === 0)
              ? (_openBlock(), _createElementBlock("div", { key: 0 }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(historySkeletonCount, (n) => {
                    return (_openBlock(), _createElementBlock("div", {
                      key: 'history-skeleton-' + n,
                      class: "history-card history-skeleton-card"
                    }, [
                      _createElementVNode("div", { style: {"flex":"1"} }, [
                        _createElementVNode("div", { class: "skeleton-line skeleton-line-title" }),
                        _createElementVNode("div", { class: "skeleton-line skeleton-line-meta" })
                      ])
                    ]))
                  }), 128 /* KEYED_FRAGMENT */))
                ]))
              : _createCommentVNode("v-if", true),
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(historyList, (item) => {
              return (_openBlock(), _createElementBlock("div", {
                key: item.id,
                class: _normalizeClass(["history-card", {'selection-mode': isSelectionMode, 'selected': selectedHistoryIds.includes(item.id)}]),
                onClick: $event => (handleHistoryItemClick(item))
              }, [
                _createCommentVNode(" Checkbox for Selection Mode "),
                isSelectionMode
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "checkbox-wrapper"
                    }, [
                      _createElementVNode("div", {
                        class: _normalizeClass(["custom-checkbox", {checked: selectedHistoryIds.includes(item.id)}])
                      }, [
                        (selectedHistoryIds.includes(item.id))
                          ? (_openBlock(), _createElementBlock("svg", {
                              key: 0,
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              "stroke-width": "3"
                            }, [
                              _createElementVNode("polyline", { points: "20 6 9 17 4 12" })
                            ]))
                          : _createCommentVNode("v-if", true)
                      ], 2 /* CLASS */)
                    ]))
                  : _createCommentVNode("v-if", true),
                _createElementVNode("div", { style: {"flex":"1"} }, [
                  _createElementVNode("div", { class: "card-header" }, [
                    _createElementVNode("span", { class: "card-title" }, _toDisplayString(formatHistoryTitle(item.description)), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "card-meta" }, [
                    _createElementVNode("div", { class: "meta-row" }, [
                      _createElementVNode("span", { class: "meta-tag mode-tag" }, [
                        (item.params && item.params.mode === 'driving')
                          ? (_openBlock(), _createElementBlock("span", { key: 0 }, [
                              _createElementVNode("img", { src: "/static/images/driving.svg" }),
                              _createTextVNode(" 椹捐溅 ")
                            ]))
                          : (item.params && item.params.mode === 'bicycling')
                            ? (_openBlock(), _createElementBlock("span", { key: 1 }, [
                                _createElementVNode("img", { src: "/static/images/cycling.svg" }),
                                _createTextVNode(" 楠戣 ")
                              ]))
                            : (_openBlock(), _createElementBlock("span", { key: 2 }, [
                                _createElementVNode("img", { src: "/static/images/walking.svg" }),
                                _createTextVNode(" 姝ヨ ")
                              ]))
                      ]),
                      (item.params && item.params.time_min)
                        ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "meta-tag time-tag"
                          }, [
                            _createElementVNode("img", { src: "/static/images/time.svg" }),
                            _createTextVNode(" " + _toDisplayString(item.params.time_min) + "鍒? ", 1 /* TEXT */)
                          ]))
                        : _createCommentVNode("v-if", true),
                      _createElementVNode("span", { class: "meta-tag source-tag" }, " 鏁版嵁婧?" + _toDisplayString(item._sourceLabel || '鏈爣璁?'), 1 /* TEXT */)
                    ]),
                    _createElementVNode("span", { class: "meta-date" }, _toDisplayString(item._createdDateText || item.created_at), 1 /* TEXT */)
                  ])
                ])
              ], 10 /* CLASS, PROPS */, ["onClick"]))
            }), 128 /* KEYED_FRAGMENT */)),
            _createCommentVNode(" Batch Delete Footer "),
            isSelectionMode
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  style: {"position":"fixed","bottom":"0","left":"0","width":"var(--sidebar-width)","background":"#fff","padding":"15px","border-top":"1px solid #eee","box-shadow":"0 -2px 10px rgba(0,0,0,0.05)","z-index":"100","box-sizing":"border-box","display":"flex","gap":"10px"}
                }, [
                  _createElementVNode("button", {
                    class: "btn-black",
                    disabled: selectedHistoryIds.length === 0,
                    onClick: deleteSelectedHistory,
                    style: {"background":"#ff4d4f","border":"none","width":"100%"}
                  }, " 鍒犻櫎閫変腑 (" + _toDisplayString(selectedHistoryIds.length) + ") ", 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                ]))
              : _createCommentVNode("v-if", true),
            (!historyLoading && historyList.length === 0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  style: {"text-align":"center","padding":"40px 20px","color":"#999","display":"flex","flex-direction":"column","align-items":"center"}
                }, [
                  _createElementVNode("img", {
                    src: "/static/images/empty.svg",
                    style: {"width":"48px","height":"48px","opacity":"0.3","margin-bottom":"10px"}
                  }),
                  _createElementVNode("span", null, "鏆傛棤鍘嗗彶璁板綍")
                ]))
              : _createCommentVNode("v-if", true)
          ], 512 /* NEED_PATCH */), [
            [_vShow, sidebarView === 'history']
          ]),
          _createCommentVNode(" Wizard View Wrapper "),
          _withDirectives(_createElementVNode("div", { style: {"display":"contents"} }, [
            _createCommentVNode(" Step 1: Location & Analysis "),
            _withDirectives(_createElementVNode("div", { class: "wizard-step" }, [
              _createElementVNode("div", { class: "step-title" }, [
                _createElementVNode("h3", null, "1. 鍦扮偣涓庤寖鍥")
              ]),
              _createElementVNode("div", { class: "form-group" }, [
                _createElementVNode("label", null, "鑼冨洿妯″紡"),
                _createElementVNode("div", { class: "mode-select" }, [
                  _createElementVNode("div", { class: "mode-select" }, [
                    _createElementVNode("div", {
                      class: _normalizeClass(["mode-option", {active: isochroneScopeMode==='point'}]),
                      onClick: $event => (setIsochroneScopeMode('point'))
                    }, "鐐圭瓑鏃跺湀", 10 /* CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("div", {
                      class: _normalizeClass(["mode-option", {active: isochroneScopeMode==='area'}]),
                      onClick: $event => (setIsochroneScopeMode('area'))
                    }, "闈㈢瓑鏃跺湀", 10 /* CLASS, PROPS */, ["onClick"])
                  ])
                ])
              ]),
              (isochroneScopeMode === 'point')
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-group search-group"
                  }, [
                    _createElementVNode("input", {
                      type: "text",
                      id: "keyword",
                      class: "minimal-input",
                      placeholder: "鎼滅储鍦扮偣...",
                      onKeyup: _withKeys(triggerSearch, ["enter"])
                    }, null, 40 /* PROPS, NEED_HYDRATION */, ["onKeyup"]),
                    _createElementVNode("button", {
                      class: "btn-icon",
                      onClick: triggerSearch
                    }, [
                      (_openBlock(), _createElementBlock("svg", {
                        width: "20",
                        height: "20",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "2"
                      }, [
                        _createElementVNode("circle", {
                          cx: "11",
                          cy: "11",
                          r: "8"
                        }),
                        _createElementVNode("line", {
                          x1: "21",
                          y1: "21",
                          x2: "16.65",
                          y2: "16.65"
                        })
                      ]))
                    ], 8 /* PROPS */, ["onClick"])
                  ]))
                : _createCommentVNode("v-if", true),
              _createElementVNode("div", { class: "form-group" }, [
                (isochroneScopeMode === 'area' && hasDrawnScopePolygon())
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "status-badge success"
                    }, " 宸茬粯鍒跺尯鍩? " + _toDisplayString(getDrawnScopePointCount()) + " 涓《鐐? ", 1 /* TEXT */))
                  : (isochroneScopeMode === 'point' && selectedPoint)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "status-badge success"
                      }, " 宸查€? " + _toDisplayString(selectedPoint.lng.toFixed(4)) + ", " + _toDisplayString(selectedPoint.lat.toFixed(4)), 1 /* TEXT */))
                    : (isochroneScopeMode === 'point')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "status-badge warning"
                        }, "璇峰湪鍦板浘涓婄偣鍑?鎼滅储閫夋嫨璧风偣"))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 3,
                          class: "status-badge warning"
                        }, "璇峰厛缁樺埗鍒嗘瀽鍖哄煙"))
              ]),
              _createElementVNode("div", { class: "form-group" }, [
                _createElementVNode("label", null, "鍑鸿鏂瑰紡"),
                _createElementVNode("div", { class: "mode-select" }, [
                  _createElementVNode("div", { class: "mode-select" }, [
                    _createElementVNode("div", {
                      class: _normalizeClass(["mode-option", {active: transportMode==='walking'}]),
                      onClick: $event => (transportMode='walking')
                    }, [
                      _createTextVNode("姝ヨ "),
                      _createElementVNode("img", { src: "/static/images/walking.svg" })
                    ], 10 /* CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("div", {
                      class: _normalizeClass(["mode-option", {active: transportMode==='bicycling'}]),
                      onClick: $event => (transportMode='bicycling')
                    }, [
                      _createTextVNode("楠戣 "),
                      _createElementVNode("img", { src: "/static/images/cycling.svg" })
                    ], 10 /* CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("div", {
                      class: _normalizeClass(["mode-option", {active: transportMode==='driving'}]),
                      onClick: $event => (transportMode='driving')
                    }, [
                      _createTextVNode("椹捐溅 "),
                      _createElementVNode("img", { src: "/static/images/driving.svg" })
                    ], 10 /* CLASS, PROPS */, ["onClick"])
                  ])
                ])
              ]),
              _createElementVNode("div", { class: "form-group" }, [
                _createElementVNode("label", null, "鏃堕棿鑼冨洿: " + _toDisplayString(timeHorizon) + " 鍒嗛挓", 1 /* TEXT */),
                _withDirectives(_createElementVNode("input", {
                  type: "range",
                  "onUpdate:modelValue": $event => ((timeHorizon) = $event),
                  class: "minimal-range",
                  min: "5",
                  max: "60",
                  step: "5"
                }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                  [
                    _vModelText,
                    timeHorizon,
                    void 0,
                    { number: true }
                  ]
                ])
              ]),
              _createElementVNode("div", {
                class: "form-group",
                style: {"display":"flex","align-items":"center","gap":"8px"}
              }, [
                _createElementVNode("label", { style: {"margin":"0"} }, "搴曞浘婧"),
                _withDirectives(_createElementVNode("select", {
                  "onUpdate:modelValue": $event => ((basemapSource) = $event),
                  onChange: onBasemapSourceChange,
                  class: "minimal-input",
                  style: {"padding":"4px 8px","max-width":"180px"}
                }, [
                  _createElementVNode("option", { value: "tianditu" }, "澶╁湴鍥撅紙鍥藉唴绉戠爺锛"),
                  _createElementVNode("option", { value: "osm" }, "OpenStreetMap锛堢鐮旓級"),
                  _createElementVNode("option", { value: "amap" }, "楂樺痉锛堜笟鍔★級")
                ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                  [_vModelSelect, basemapSource]
                ])
              ]),
              (isochroneScopeMode === 'area')
                ? (_openBlock(), _createElementBlock("button", {
                    key: 1,
                    class: "btn-outline",
                    style: {"margin-top":"8px"},
                    disabled: isCalculating,
                    onClick: toggleScopeDrawing
                  }, _toDisplayString(drawScopeActive ? '缁撴潫缁樺埗' : '缁樺埗鍖哄煙锛堝杈瑰舰锛? '), 9 /* TEXT, PROPS */, ["disabled", "onClick"]))
                : _createCommentVNode("v-if", true),
              (isochroneScopeMode === 'area')
                ? (_openBlock(), _createElementBlock("button", {
                    key: 2,
                    class: "btn-outline",
                    style: {"margin-top":"8px"},
                    disabled: isCalculating || !hasDrawnScopePolygon(),
                    onClick: clearDrawnScopePolygon
                  }, " 娓呴櫎缁樺埗鍖哄煙 ", 8 /* PROPS */, ["disabled", "onClick"]))
                : _createCommentVNode("v-if", true),
              (isochroneScopeMode === 'point')
                ? (_openBlock(), _createElementBlock("button", {
                    key: 3,
                    class: "btn-black",
                    disabled: !selectedPoint || isCalculating || drawScopeActive,
                    onClick: startAnalysis
                  }, _toDisplayString(isCalculating ? '澶勭悊涓?..' : '涓嬩竴姝? 鐢熸垚绛夋椂鍦? '), 9 /* TEXT, PROPS */, ["disabled", "onClick"]))
                : _createCommentVNode("v-if", true),
              (isochroneScopeMode === 'point')
                ? (_openBlock(), _createElementBlock("button", {
                    key: 4,
                    class: "btn-outline",
                    style: {"margin-top":"8px"},
                    disabled: !selectedPoint || isCalculating || drawScopeActive,
                    onClick: startCircleAnalysis
                  }, _toDisplayString(isCalculating ? '澶勭悊涓?..' : '涓嬩竴姝? 鐢熸垚鍦嗗舰鍦? '), 9 /* TEXT, PROPS */, ["disabled", "onClick"]))
                : _createCommentVNode("v-if", true),
              (isochroneScopeMode === 'area')
                ? (_openBlock(), _createElementBlock("button", {
                    key: 5,
                    class: "btn-black",
                    disabled: !hasDrawnScopePolygon() || isCalculating || drawScopeActive,
                    onClick: startAnalysis
                  }, _toDisplayString(isCalculating ? '澶勭悊涓?..' : '涓嬩竴姝? 鍩轰簬缁樺埗鑼冨洿鐢熸垚绛夋椂鍦? '), 9 /* TEXT, PROPS */, ["disabled", "onClick"]))
                : _createCommentVNode("v-if", true),
              errorMessage
                ? (_openBlock(), _createElementBlock("div", {
                    key: 6,
                    class: "error-msg"
                  }, _toDisplayString(errorMessage), 1 /* TEXT */))
                : _createCommentVNode("v-if", true),
              (basemapSource === 'tianditu' && tdtDiag && tdtDiag.ok === false)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 7,
                    style: {"margin-top":"10px","padding":"10px","border":"1px solid #f1b0b7","border-radius":"8px","background":"#fff7f7"}
                  }, [
                    _createElementVNode("div", { style: {"font-size":"12px","font-weight":"600","color":"#9f1239","margin-bottom":"6px"} }, "澶╁湴鍥捐瘖鏂俊鎭"),
                    _createElementVNode("div", { style: {"font-size":"11px","color":"#6b7280","line-height":"1.5","margin-bottom":"6px"} }, " 闃舵=" + _toDisplayString(tdtDiag.phase || '-') + "锛涚姸鎬?" + _toDisplayString(tdtDiag.status === null || tdtDiag.status === undefined ? '-' : tdtDiag.status) + "锛涘唴瀹圭被鍨?" + _toDisplayString(tdtDiag.contentType || '-'), 1 /* TEXT */),
                    _createElementVNode("pre", { style: {"margin":"0","max-height":"120px","overflow":"auto","white-space":"pre-wrap","word-break":"break-all","font-size":"11px","line-height":"1.45","color":"#4b5563","background":"#fff","border":"1px solid #e5e7eb","border-radius":"6px","padding":"8px"} }, _toDisplayString(buildTdtDiagText()), 1 /* TEXT */),
                    _createElementVNode("div", { style: {"display":"flex","align-items":"center","gap":"8px","margin-top":"8px"} }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-outline",
                        style: {"margin-top":"0","padding":"6px 12px","width":"auto"},
                        onClick: copyTdtDiag
                      }, " 澶嶅埗璇婃柇 ", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("span", { style: {"font-size":"11px","color":"#6b7280"} }, _toDisplayString(tdtDiagCopyStatus), 1 /* TEXT */)
                    ])
                  ]))
                : _createCommentVNode("v-if", true)
            ], 512 /* NEED_PATCH */), [
              [_vShow, step === 1]
            ]),
            _createCommentVNode(" Step 2: Results & Filter "),
            _withDirectives(_createElementVNode("div", { class: "wizard-step wizard-step-step3" }, [
              _withDirectives(_createElementVNode("div", { class: "step-header-nav step3-header-nav" }, [
                _createElementVNode("div", { class: "step3-header-main" }, [
                  _createElementVNode("h3", null, "2. 缁撴灉鍒嗘瀽")
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: "btn-text-back step3-sidebar-toggle",
                  title: "Collapse sidebar",
                  "aria-label": "Collapse sidebar",
                  onClick: $event => (toggleStep3SidebarCollapsed(true))
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    class: "step3-sidebar-toggle-icon",
                    viewBox: "0 0 24 24",
                    "aria-hidden": "true"
                  }, [
                    _createElementVNode("rect", {
                      x: "3.5",
                      y: "4",
                      width: "17",
                      height: "16",
                      rx: "3"
                    }),
                    _createElementVNode("line", {
                      x1: "9",
                      y1: "4",
                      x2: "9",
                      y2: "20"
                    }),
                    _createElementVNode("polyline", { points: "11.5,12 14,9.5 14,14.5 11.5,12" })
                  ]))
                ], 8 /* PROPS */, ["onClick"])
              ], 512 /* NEED_PATCH */), [
                [_vShow, !isStep3SidebarCollapsed]
              ]),
              _createElementVNode("div", {
                class: _normalizeClass(["step3-layout", { 'is-collapsed': isStep3SidebarCollapsed }])
              }, [
                isStep3SidebarCollapsed
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "step3-collapsed-top"
                    }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-text-back step3-sidebar-expand-toggle",
                        title: "Expand sidebar",
                        "aria-label": "Expand sidebar",
                        onClick: $event => (toggleStep3SidebarCollapsed(false))
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          class: "step3-sidebar-toggle-icon",
                          viewBox: "0 0 24 24",
                          "aria-hidden": "true"
                        }, [
                          _createElementVNode("rect", {
                            x: "3.5",
                            y: "4",
                            width: "17",
                            height: "16",
                            rx: "3"
                          }),
                          _createElementVNode("line", {
                            x1: "9",
                            y1: "4",
                            x2: "9",
                            y2: "20"
                          }),
                          _createElementVNode("polyline", { points: "14.5,12 12,9.5 12,14.5 14.5,12" })
                        ]))
                      ], 8 /* PROPS */, ["onClick"])
                    ]))
                  : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "nav-rail" }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(step3NavItems, (item, index) => {
                    return (_openBlock(), _createElementBlock("div", {
                      key: item.id,
                      class: _normalizeClass(["nav-item", {
                                        active: activeStep3Panel === item.id,
                                        dragging: dragIndex === index,
                                        'insert-before': isDraggingNav && dragOverIndex === index && dragInsertPosition === 'before',
                                        'insert-after': isDraggingNav && dragOverIndex === index && dragInsertPosition === 'after'
                                    }]),
                      title: item.title,
                      draggable: "true",
                      onClick: $event => (selectStep3Panel(item.id)),
                      onDragstart: $event => (onStep3DragStart(index, $event)),
                      onDragover: $event => (onStep3DragOver(index, $event)),
                      onDrop: $event => (onStep3Drop(index)),
                      onDragend: onStep3DragEnd
                    }, [
                      _createElementVNode("span", null, _toDisplayString(item.label), 1 /* TEXT */),
                      (item.id === 'agent' && getRunningAgentSessionCount() > 0)
                        ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "agent-nav-running-badge"
                          }, _toDisplayString(getAgentRunningBadgeText()), 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
                    ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["title", "onClick", "onDragstart", "onDragover", "onDrop", "onDragend"]))
                  }), 128 /* KEYED_FRAGMENT */))
                ]),
                _withDirectives(_createElementVNode("div", { class: "panel-area panel-area-fill" }, [
                  _withDirectives(_createElementVNode("div", {
                    class: "panel agent-panel agent-sidebar-panel",
                    onClick: closeAgentSessionMenu
                  }, [
                    _createElementVNode("button", {
                      type: "button",
                      class: "agent-sidebar-new-btn",
                      onClick: startNewAgentChat
                    }, [
                      (_openBlock(), _createElementBlock("svg", {
                        class: "agent-sidebar-new-icon",
                        viewBox: "0 0 24 24",
                        "aria-hidden": "true"
                      }, [
                        _createElementVNode("path", { d: "M12 20h9" }),
                        _createElementVNode("path", { d: "M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" }),
                        _createElementVNode("path", { d: "M15 5l3 3" })
                      ])),
                      _createElementVNode("span", { class: "agent-sidebar-new-title" }, "鏂拌亰澶")
                    ], 8 /* PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["agent-sidebar-new-btn agent-sidebar-tool-btn", { active: agentWorkspaceView === 'tools' }]),
                      onClick: openAgentToolsPanel
                    }, [
                      (_openBlock(), _createElementBlock("svg", {
                        class: "agent-sidebar-new-icon",
                        viewBox: "0 0 24 24",
                        "aria-hidden": "true"
                      }, [
                        _createElementVNode("path", { d: "M4 7h16" }),
                        _createElementVNode("path", { d: "M4 12h16" }),
                        _createElementVNode("path", { d: "M4 17h16" })
                      ])),
                      _createElementVNode("span", { class: "agent-sidebar-new-title" }, "宸ュ叿"),
                      agentToolsLoading
                        ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "agent-sidebar-tool-loading"
                          }, "鍔犺浇涓"))
                        : _createCommentVNode("v-if", true)
                    ], 10 /* CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("div", { class: "agent-sidebar-section" }, [
                      _createElementVNode("div", { class: "agent-sidebar-section-label" }, "鍘嗗彶"),
                      _createElementVNode("div", {
                        class: "agent-sidebar-history",
                        onClick: closeAgentSessionMenu,
                        onScrollPassive: closeAgentSessionMenu
                      }, [
                        (getAgentHistorySessions().length)
                          ? (_openBlock(true), _createElementBlock(_Fragment, { key: 0 }, _renderList(getAgentRangeSessionGroups(), (group) => {
                              return (_openBlock(), _createElementBlock("div", {
                                key: `agent-history-group-${group.id}`,
                                class: "agent-sidebar-history-group"
                              }, [
                                _createElementVNode("div", { class: "agent-sidebar-history-folder" }, [
                                  _createElementVNode("span", { class: "agent-sidebar-history-folder-icon" }),
                                  _createElementVNode("span", null, _toDisplayString(group.title), 1 /* TEXT */),
                                  _createElementVNode("span", { class: "agent-sidebar-history-folder-count" }, _toDisplayString(group.count), 1 /* TEXT */)
                                ]),
                                (group.sessions.length)
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 0,
                                      class: "agent-sidebar-history-group-list"
                                    }, [
                                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(group.sessions, (session) => {
                                        return (_openBlock(), _createElementBlock("div", {
                                          key: session.id,
                                          class: _normalizeClass(["agent-sidebar-history-item", {
                                                                active: activeAgentSessionId === session.id,
                                                                'is-loading': agentSessionDetailLoadingId === session.id,
                                                                'menu-open': agentSessionMenuId === session.id
                                                            }]),
                                          onClick: _withModifiers(() => {}, ["stop"])
                                        }, [
                                          _createElementVNode("button", {
                                            type: "button",
                                            class: "agent-sidebar-history-main",
                                            onClick: $event => (activateAgentSession(session.id))
                                          }, [
                                            _createElementVNode("div", { class: "agent-sidebar-history-head" }, [
                                              _createElementVNode("div", { class: "agent-sidebar-history-title" }, _toDisplayString(getAgentSessionTitle(session)), 1 /* TEXT */),
                                              (isAgentSessionRunning(session.id))
                                                ? (_openBlock(), _createElementBlock("span", {
                                                    key: 0,
                                                    class: "agent-sidebar-history-running"
                                                  }, "鎵ц涓"))
                                                : _createCommentVNode("v-if", true),
                                              (session.isPinned)
                                                ? (_openBlock(), _createElementBlock("span", {
                                                    key: 1,
                                                    class: "agent-sidebar-history-pin"
                                                  }, "缃《"))
                                                : _createCommentVNode("v-if", true)
                                            ]),
                                            _createElementVNode("div", { class: "agent-sidebar-history-preview" }, _toDisplayString(getAgentSessionPreview(session)), 1 /* TEXT */)
                                          ], 8 /* PROPS */, ["onClick"]),
                                          _createElementVNode("div", { class: "agent-sidebar-history-actions" }, [
                                            _createElementVNode("button", {
                                              type: "button",
                                              class: "agent-sidebar-history-menu-btn",
                                              title: agentSessionMenuId === session.id ? '鍏抽棴鎿嶄綔鑿滃崟' : '鎵撳紑鎿嶄綔鑿滃崟',
                                              onClick: $event => (toggleAgentSessionMenu(session.id, $event))
                                            }, [
                                              _createElementVNode("span"),
                                              _createElementVNode("span"),
                                              _createElementVNode("span")
                                            ], 8 /* PROPS */, ["title", "onClick"]),
                                            (agentSessionMenuId === session.id)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 0,
                                                  class: "agent-sidebar-history-menu",
                                                  onClick: _withModifiers(() => {}, ["stop"])
                                                }, [
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    onClick: $event => (openAgentRenameDialog(session.id, $event))
                                                  }, "閲嶅懡鍚", 8 /* PROPS */, ["onClick"]),
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    onClick: $event => (toggleAgentSessionPinned(session.id, $event))
                                                  }, _toDisplayString(session.isPinned ? '鍙栨秷缃《' : '缃《'), 9 /* TEXT, PROPS */, ["onClick"]),
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    class: "is-danger",
                                                    onClick: $event => (deleteAgentSession(session.id, $event))
                                                  }, "鍒犻櫎", 8 /* PROPS */, ["onClick"])
                                                ], 8 /* PROPS */, ["onClick"]))
                                              : _createCommentVNode("v-if", true)
                                          ])
                                        ], 10 /* CLASS, PROPS */, ["onClick"]))
                                      }), 128 /* KEYED_FRAGMENT */))
                                    ]))
                                  : (_openBlock(), _createElementBlock("div", {
                                      key: 1,
                                      class: "agent-sidebar-history-empty"
                                    }, _toDisplayString(group.emptyText), 1 /* TEXT */))
                              ]))
                            }), 128 /* KEYED_FRAGMENT */))
                          : (_openBlock(), _createElementBlock("div", {
                              key: 1,
                              class: "agent-sidebar-history-empty"
                            }, " 鏆傛棤鍘嗗彶瀵硅瘽 "))
                      ], 40 /* PROPS, NEED_HYDRATION */, ["onClick", "onScrollPassive"])
                    ]),
                    agentRenameDialogOpen
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "agent-rename-dialog-mask",
                          onClick: closeAgentRenameDialog
                        }, [
                          _createElementVNode("div", {
                            class: "agent-rename-dialog",
                            onClick: _withModifiers(() => {}, ["stop"])
                          }, [
                            _createElementVNode("div", { class: "agent-rename-dialog-title" }, "閲嶅懡鍚嶅璇"),
                            _withDirectives(_createElementVNode("input", {
                              "onUpdate:modelValue": $event => ((agentRenameInput) = $event),
                              type: "text",
                              class: "agent-rename-dialog-input",
                              maxlength: "60",
                              placeholder: "璇疯緭鍏ュ璇濆悕绉?",
                              onKeydown: _withKeys(_withModifiers(submitAgentRename, ["prevent"]), ["enter"])
                            }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onKeydown"]), [
                              [_vModelText, agentRenameInput]
                            ]),
                            _createElementVNode("div", { class: "agent-rename-dialog-actions" }, [
                              _createElementVNode("button", {
                                type: "button",
                                class: "agent-rename-btn agent-rename-btn-secondary",
                                onClick: closeAgentRenameDialog
                              }, "鍙栨秷", 8 /* PROPS */, ["onClick"]),
                              _createElementVNode("button", {
                                type: "button",
                                class: "agent-rename-btn agent-rename-btn-primary",
                                onClick: submitAgentRename
                              }, "纭畾", 8 /* PROPS */, ["onClick"])
                            ])
                          ], 8 /* PROPS */, ["onClick"])
                        ], 8 /* PROPS */, ["onClick"]))
                      : _createCommentVNode("v-if", true)
                  ], 8 /* PROPS */, ["onClick"]), [
                    [_vShow, activeStep3Panel === 'agent']
                  ]),
                  _withDirectives(_createElementVNode("div", { class: "panel poi-panel" }, [
                    _createElementVNode("div", { class: "poi-panel-topbar" }, [
                      _createElementVNode("div", { class: "h3-subtabs h3-stage-tabs poi-stage-tabs" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: poiSubTab === 'load' }]),
                          onClick: $event => (setPoiSubTab('load'))
                        }, "鎶撳彇", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: poiSubTab === 'category' }]),
                          onClick: $event => (setPoiSubTab('category'))
                        }, "鍒嗙被", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: poiSubTab === 'analysis' }]),
                          onClick: $event => (setPoiSubTab('analysis'))
                        }, "鍒嗘瀽", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: poiSubTab === 'grid' }]),
                          onClick: $event => (setPoiSubTab('grid'))
                        }, "缃戞牸", 10 /* CLASS, PROPS */, ["onClick"])
                      ]),
                      _withDirectives(_createElementVNode("div", { class: "poi-panel-header" }, [
                        _createElementVNode("div", { class: "poi-panel-actions" }, [
                          _createElementVNode("span", {
                            id: "poiTotalCount",
                            class: "count-badge"
                          }, "鎬绘暟 0"),
                          _withDirectives(_createElementVNode("button", {
                            id: "toggleAllPoi",
                            type: "button",
                            class: "btn-outline btn-compact"
                          }, "鍏ㄩ儴闅愯棌", 512 /* NEED_PATCH */), [
                            [_vShow, poiSubTab === 'category']
                          ]),
                          _withDirectives(_createElementVNode("button", {
                            id: "toggleExpandAll",
                            class: "btn-outline btn-compact"
                          }, "鍏ㄩ儴灞曞紑", 512 /* NEED_PATCH */), [
                            [_vShow, poiSubTab === 'category']
                          ])
                        ])
                      ], 512 /* NEED_PATCH */), [
                        [_vShow, poiSubTab !== 'grid']
                      ]),
                      (poiSubTab !== 'grid' && shouldShowPoiPanelStatus())
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: _normalizeClass(["poi-panel-status", { 'is-loading': isHistoryPoiRestoring() }])
                          }, [
                            (isHistoryPoiRestoring())
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 0,
                                  class: "poi-panel-status-dot"
                                }))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("span", null, _toDisplayString(getPoiPanelStatusText()), 1 /* TEXT */)
                          ], 2 /* CLASS */))
                        : _createCommentVNode("v-if", true)
                    ]),
                    _withDirectives(_createElementVNode("div", { class: "poi-subpanel" }, [
                      _createElementVNode("div", { class: "category-grid" }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(poiCategories, (cat) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: cat.id,
                            class: _normalizeClass(["cat-card", {checked: cat.checked}])
                          }, [
                            _createElementVNode("div", {
                              class: "cat-color",
                              style: _normalizeStyle({background: cat.color})
                            }, null, 4 /* STYLE */),
                            _createElementVNode("div", { class: "cat-texts" }, [
                              _createElementVNode("div", { class: "cat-header-row" }, [
                                _createElementVNode("label", {
                                  class: "cat-check",
                                  onClick: _withModifiers(() => {}, ["stop"])
                                }, [
                                  _createElementVNode("input", {
                                    type: "checkbox",
                                    checked: cat.checked,
                                    onChange: $event => (togglePoiCategory(cat, $event.target.checked))
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                                  _createElementVNode("span", { class: "cat-name" }, _toDisplayString(cat.name), 1 /* TEXT */)
                                ], 8 /* PROPS */, ["onClick"]),
                                (getPoiSubItems(cat.id).length)
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 0,
                                      type: "button",
                                      class: "cat-expand-btn",
                                      onClick: _withModifiers($event => (togglePoiCategoryExpand(cat.id)), ["stop"])
                                    }, _toDisplayString(expandedPoiCategoryId === cat.id ? '鏀惰捣' : '灞曞紑'), 9 /* TEXT, PROPS */, ["onClick"]))
                                  : _createCommentVNode("v-if", true)
                              ]),
                              (getPoiSubItems(cat.id).length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "cat-subtypes"
                                  }, " 宸查€?" + _toDisplayString(getPoiSubSelectedCount(cat.id)) + "/" + _toDisplayString(getPoiSubItems(cat.id).length) + " 涓皬绫? ", 1 /* TEXT */))
                                : _createCommentVNode("v-if", true),
                              (getPoiSubItems(cat.id).length)
                                ? _withDirectives((_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "cat-subitem-list"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getPoiSubItems(cat.id), (item) => {
                                      return (_openBlock(), _createElementBlock("label", {
                                        key: `step2-sub-${cat.id}-${item.id}`,
                                        class: "cat-subitem",
                                        onClick: _withModifiers(() => {}, ["stop"])
                                      }, [
                                        _createElementVNode("input", {
                                          type: "checkbox",
                                          checked: isPoiSubItemChecked(item.id),
                                          onChange: $event => (onPoiSubItemToggle(cat, item, $event.target.checked))
                                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                                        _createElementVNode("span", null, _toDisplayString(item.label), 1 /* TEXT */)
                                      ], 8 /* PROPS */, ["onClick"]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ], 512 /* NEED_PATCH */)), [
                                    [_vShow, expandedPoiCategoryId === cat.id]
                                  ])
                                : _createCommentVNode("v-if", true)
                            ])
                          ], 2 /* CLASS */))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]),
                      _createElementVNode("div", {
                        class: "form-group",
                        style: {"display":"flex","align-items":"center","gap":"8px"}
                      }, [
                        _createElementVNode("label", { style: {"margin":"0"} }, "鏁版嵁鏉ユ簮"),
                        _withDirectives(_createElementVNode("select", {
                          "onUpdate:modelValue": $event => ((poiDataSource) = $event),
                          class: "minimal-input",
                          style: {"padding":"4px 8px","max-width":"180px"}
                        }, [
                          _createElementVNode("option", { value: "local" }, "鏈湴婧愶紙2018骞达級"),
                          _createElementVNode("option", { value: "gaode" }, "楂樺痉婧")
                        ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                          [_vModelSelect, poiDataSource]
                        ])
                      ]),
                      _createElementVNode("button", {
                        class: "btn-black",
                        disabled: isFetchingPois,
                        onClick: fetchPois
                      }, _toDisplayString(isFetchingPois ? '鏁版嵁鎶撳彇涓?' + fetchProgress + '%' : '寮€濮嬫姄鍙?POI'), 9 /* TEXT, PROPS */, ["disabled", "onClick"]),
                      isFetchingPois
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            style: {"margin-top":"10px","background":"#f0f0f0","height":"6px","border-radius":"3px","overflow":"hidden"}
                          }, [
                            _createElementVNode("div", {
                              style: _normalizeStyle({width: fetchProgress + '%', background:'#000', height:'100%', transition:'width 0.3s ease'})
                            }, null, 4 /* STYLE */)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (isFetchingPois && fetchSubtypeProgress.categoryName)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "fetch-subtype-progress"
                          }, [
                            _createElementVNode("div", { class: "line" }, [
                              _createElementVNode("span", { class: "label" }, "褰撳墠澶х被锛"),
                              _createElementVNode("span", null, _toDisplayString(fetchSubtypeProgress.categoryName), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", { class: "line" }, [
                              _createElementVNode("span", { class: "label" }, "宸插懡涓皬绫伙細"),
                              (fetchSubtypeProgress.typeNamesPreview.length)
                                ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                    _createElementVNode("span", null, _toDisplayString(fetchSubtypeProgress.typeNamesPreview.join('、')), 1 /* TEXT */),
                                    (fetchSubtypeProgress.hiddenTypeCount > 0)
                                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, " 等 " + _toDisplayString(fetchSubtypeProgress.typeNamesFullCount) + " 个小类 ", 1 /* TEXT */))
                                      : _createCommentVNode("v-if", true)
                                  ], 64 /* STABLE_FRAGMENT */))
                                : (_openBlock(), _createElementBlock("span", { key: 1 }, "鏆傛棤"))
                            ])
                          ]))
                        : _createCommentVNode("v-if", true)
                    ], 512 /* NEED_PATCH */), [
                      [_vShow, poiSubTab === 'load']
                    ]),
                    _withDirectives(_createElementVNode("div", { class: "poi-subpanel" }, [
                      _createElementVNode("div", {
                        id: "filtersContainer",
                        class: "poi-filters-wrapper"
                      })
                    ], 512 /* NEED_PATCH */), [
                      [_vShow, poiSubTab === 'category']
                    ]),
                    _withDirectives(_createElementVNode("div", { class: "poi-subpanel poi-kde-panel" }, [
                      _createElementVNode("div", { class: "h3-subtabs poi-analysis-tabs" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill", { active: poiAnalysisSubTab === 'kde' }]),
                          onClick: $event => (setPoiAnalysisSubTab('kde'))
                        }, "鏍稿瘑搴", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill", { active: poiAnalysisSubTab === 'stats' }]),
                          onClick: $event => (setPoiAnalysisSubTab('stats'))
                        }, "缁熻", 10 /* CLASS, PROPS */, ["onClick"])
                      ]),
                      _createElementVNode("div", { class: "poi-kde-intro" }, [
                        _createElementVNode("div", { class: "poi-kde-title" }, _toDisplayString(poiAnalysisSubTab === 'stats' ? '鐑偣缁熻瑙嗗浘' : '鏍稿瘑搴︾儹鍔涘浘'), 1 /* TEXT */)
                      ]),
                      _withDirectives(_createElementVNode("div", { class: "poi-kde-controls" }, [
                        _createElementVNode("label", { class: "poi-kde-range-field" }, [
                          _createElementVNode("span", null, "鏍稿瘑搴﹀崐寰"),
                          _withDirectives(_createElementVNode("input", {
                            type: "range",
                            min: "12",
                            max: "60",
                            step: "2",
                            "onUpdate:modelValue": $event => ((poiKdeRadius) = $event),
                            onInput: refreshPoiKdeOverlay
                          }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onInput"]), [
                            [
                              _vModelText,
                              poiKdeRadius,
                              void 0,
                              { number: true }
                            ]
                          ]),
                          _createElementVNode("strong", null, _toDisplayString(poiKdeRadius), 1 /* TEXT */)
                        ])
                      ], 512 /* NEED_PATCH */), [
                        [_vShow, poiAnalysisSubTab === 'kde']
                      ]),
                      _withDirectives(_createElementVNode("div", { class: "poi-kde-gradient-card" }, [
                        _createElementVNode("div", { class: "poi-kde-gradient-head" }, [
                          _createElementVNode("span", null, "鐑姏寮哄害"),
                          _createElementVNode("span", null, "浣?鈫?楂")
                        ]),
                        _createElementVNode("div", { class: "poi-kde-gradient-bar" })
                      ], 512 /* NEED_PATCH */), [
                        [_vShow, poiAnalysisSubTab === 'kde']
                      ]),
                      _withDirectives(_createElementVNode("div", { class: "poi-kde-stat-grid" }, [
                        _createElementVNode("div", { class: "poi-kde-stat-card" }, [
                          _createElementVNode("span", { class: "poi-kde-stat-label" }, "鍙 POI"),
                          _createElementVNode("strong", null, _toDisplayString(poiKdeStats.visiblePointCount), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "poi-kde-stat-card" }, [
                          _createElementVNode("span", { class: "poi-kde-stat-label" }, "鐑姏涓婇檺"),
                          _createElementVNode("strong", null, _toDisplayString(poiKdeStats.maxIntensity), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "poi-kde-stat-card" }, [
                          _createElementVNode("span", { class: "poi-kde-stat-label" }, "鐑偣绫诲埆"),
                          _createElementVNode("strong", null, _toDisplayString(poiKdeStats.topCategoryRows.length), 1 /* TEXT */)
                        ])
                      ], 512 /* NEED_PATCH */), [
                        [_vShow, poiAnalysisSubTab === 'stats']
                      ]),
                      _withDirectives(_createElementVNode("div", { class: "poi-kde-chart-card" }, [
                        _createElementVNode("div", { class: "poi-kde-chart-head" }, [
                          _createElementVNode("span", null, "鐑偣绫诲埆鏌辩姸鍥"),
                          _createElementVNode("span", null, "鍏ㄩ儴绫诲埆")
                        ]),
                        (poiKdeStats.chartRows.length)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 0,
                              class: "poi-kde-bar-chart-scroll"
                            }, [
                              _createElementVNode("div", {
                                class: "poi-kde-bar-chart",
                                style: _normalizeStyle({
                                                        gridTemplateColumns: `repeat(${Math.max(1, poiKdeStats.chartRows.length)}, minmax(34px, 1fr))`,
                                                        minWidth: `${Math.max(360, poiKdeStats.chartRows.length * 48)}px`
                                                    })
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(poiKdeStats.chartRows, (row) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: `poi-kde-chart-${row.id}`,
                                    class: "poi-kde-bar-col"
                                  }, [
                                    _createElementVNode("div", { class: "poi-kde-bar-wrap" }, [
                                      _createElementVNode("div", {
                                        class: "poi-kde-bar",
                                        style: _normalizeStyle({ height: `${row.height}%`, background: row.color })
                                      }, null, 4 /* STYLE */)
                                    ]),
                                    _createElementVNode("strong", { class: "poi-kde-bar-value" }, _toDisplayString(row.value), 1 /* TEXT */),
                                    _createElementVNode("div", { class: "poi-kde-bar-label" }, _toDisplayString(row.shortLabel), 1 /* TEXT */)
                                  ]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ], 4 /* STYLE */)
                            ]))
                          : (_openBlock(), _createElementBlock("div", {
                              key: 1,
                              class: "panel-placeholder"
                            }, "褰撳墠娌℃湁鍙敤浜庣粺璁＄殑 POI銆"))
                      ], 512 /* NEED_PATCH */), [
                        [_vShow, poiAnalysisSubTab === 'stats']
                      ])
                    ], 512 /* NEED_PATCH */), [
                      [_vShow, poiSubTab === 'analysis']
                    ]),
                    _withDirectives(_createElementVNode("div", { class: "poi-subpanel poi-grid-subpanel" }, [
                      _createElementVNode("div", { class: "h3-subtabs h3-stage-tabs" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: h3MainStage === 'params' }]),
                          onClick: $event => (onH3MainStageChange('params'))
                        }, "鍙傛暟", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: h3MainStage === 'analysis' }]),
                          onClick: $event => (onH3MainStageChange('analysis'))
                        }, "鍒嗘瀽", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: h3MainStage === 'diagnosis' }]),
                          onClick: $event => (onH3MainStageChange('diagnosis'))
                        }, "璇婃柇", 10 /* CLASS, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill h3-stage-pill", { active: h3MainStage === 'evaluate' }]),
                          onClick: $event => (onH3MainStageChange('evaluate'))
                        }, "璇勪及", 10 /* CLASS, PROPS */, ["onClick"])
                      ]),
                      (h3MainStage === 'params')
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "h3-params-card"
                          }, [
                            _createElementVNode("div", { class: "h3-params-grid" }, [
                              _createElementVNode("label", { class: "h3-params-field" }, [
                                _createElementVNode("span", { class: "h3-params-label" }, "缃戞牸绾у埆"),
                                _withDirectives(_createElementVNode("select", {
                                  "onUpdate:modelValue": $event => ((h3GridResolution) = $event),
                                  onChange: onH3ResolutionChange,
                                  class: "h3-params-select"
                                }, [
                                  _createElementVNode("option", { value: 8 }, "8", 8 /* PROPS */, ["value"]),
                                  _createElementVNode("option", { value: 9 }, "9", 8 /* PROPS */, ["value"]),
                                  _createElementVNode("option", { value: 10 }, "10", 8 /* PROPS */, ["value"]),
                                  _createElementVNode("option", { value: 11 }, "11", 8 /* PROPS */, ["value"])
                                ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                  [
                                    _vModelSelect,
                                    h3GridResolution,
                                    void 0,
                                    { number: true }
                                  ]
                                ])
                              ]),
                              _createElementVNode("label", { class: "h3-params-field" }, [
                                _createElementVNode("span", { class: "h3-params-label" }, "閭诲煙鍦堝眰"),
                                _withDirectives(_createElementVNode("select", {
                                  "onUpdate:modelValue": $event => ((h3NeighborRing) = $event),
                                  class: "h3-params-select"
                                }, [
                                  _createElementVNode("option", { value: 1 }, "ring=1", 8 /* PROPS */, ["value"]),
                                  _createElementVNode("option", { value: 2 }, "ring=2", 8 /* PROPS */, ["value"]),
                                  _createElementVNode("option", { value: 3 }, "ring=3", 8 /* PROPS */, ["value"])
                                ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                                  [
                                    _vModelSelect,
                                    h3NeighborRing,
                                    void 0,
                                    { number: true }
                                  ]
                                ])
                              ]),
                              _createElementVNode("label", { class: "h3-params-field h3-params-field-wide" }, [
                                _createElementVNode("span", { class: "h3-params-label" }, "鍖呭惈妯″紡"),
                                _withDirectives(_createElementVNode("select", {
                                  "onUpdate:modelValue": $event => ((h3GridIncludeMode) = $event),
                                  onChange: onH3GridSettingsChange,
                                  class: "h3-params-select"
                                }, [
                                  _createElementVNode("option", { value: "intersects" }, "鐩镐氦浼樺厛锛堣竟缂樹繚鐣欙級"),
                                  _createElementVNode("option", { value: "inside" }, "瀹屽叏鍖呭惈锛堜弗鏍硷級")
                                ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                  [_vModelSelect, h3GridIncludeMode]
                                ])
                              ]),
                              _createElementVNode("div", { class: "h3-params-field h3-params-field-wide" }, [
                                _createElementVNode("span", { class: "h3-params-label" }, "鏈€灏忛噸鍙犳瘮渚"),
                                _createElementVNode("div", { class: "h3-params-range-row" }, [
                                  _withDirectives(_createElementVNode("input", {
                                    type: "range",
                                    min: "0",
                                    max: "0.9",
                                    step: "0.05",
                                    "onUpdate:modelValue": $event => ((h3GridMinOverlapRatio) = $event),
                                    onChange: onH3GridSettingsChange,
                                    class: "minimal-range h3-params-range"
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [
                                      _vModelText,
                                      h3GridMinOverlapRatio,
                                      void 0,
                                      { number: true }
                                    ]
                                  ]),
                                  _createElementVNode("span", { class: "range-value" }, _toDisplayString(h3GridMinOverlapRatio.toFixed(2)), 1 /* TEXT */)
                                ])
                              ])
                            ]),
                            _createElementVNode("div", { class: "h3-params-chips" }, [
                              _createElementVNode("span", { class: "count-badge" }, "缃戞牸鏁?" + _toDisplayString(h3GridCount), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", { class: "h3-params-actions" }, [
                              _createElementVNode("button", {
                                class: "h3-btn h3-btn-ghost",
                                disabled: h3GridCount === 0,
                                onClick: clearH3Grid
                              }, " 娓呯┖缃戠粶 ", 8 /* PROPS */, ["disabled", "onClick"]),
                              _createElementVNode("button", {
                                class: "h3-btn h3-btn-primary h3-params-compute-btn",
                                disabled: isComputingH3Analysis || isGeneratingH3ArcgisSnapshot || !lastIsochroneGeoJSON,
                                onClick: computeH3Analysis
                              }, _toDisplayString(isComputingH3Analysis ? '鍒嗘瀽涓?..' : '璁＄畻鍒嗘瀽'), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage !== 'params' && h3AnalysisGridFeatures.length > 0 && getH3CurrentStageTabs().length > 1)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "h3-subtabs",
                            style: {"margin-top":"6px","grid-template-columns":"repeat(2, minmax(0, 1fr))"}
                          }, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getH3CurrentStageTabs(), (tab) => {
                              return (_openBlock(), _createElementBlock("button", {
                                type: "button",
                                class: _normalizeClass(["h3-subtab-pill", { active: h3SubTab === tab }]),
                                key: `h3-subtab-${tab}`,
                                onClick: $event => (onH3SubTabChange(tab))
                              }, _toDisplayString(h3SubTabLabels[tab] || tab), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3AnalysisGridFeatures.length > 0 && h3MainStage === 'analysis' && h3SubTab === 'metric_map')
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "filter-section",
                            style: {"margin-top":"8px","display":"flex","align-items":"center","gap":"10px","flex-wrap":"wrap"}
                          }, [
                            _createElementVNode("label", { style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"} }, [
                              _createTextVNode(" 鍦板浘鎸囨爣 "),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((h3MetricView) = $event),
                                onChange: onH3MetricViewChange,
                                style: {"padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                              }, [
                                _createElementVNode("option", { value: "density" }, "瀵嗗害"),
                                _createElementVNode("option", { value: "entropy" }, "灞€閮ㄧ喌"),
                                _createElementVNode("option", { value: "neighbor_delta" }, "閭诲煙宸€硷紙鏈牸-閭诲煙锛")
                              ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [_vModelSelect, h3MetricView]
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3AnalysisGridFeatures.length > 0 && h3MainStage === 'analysis' && h3SubTab === 'structure_map')
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 3,
                            class: "filter-section",
                            style: {"margin-top":"8px","display":"flex","align-items":"center","gap":"10px","flex-wrap":"wrap"}
                          }, [
                            _createElementVNode("label", { style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"} }, [
                              _createTextVNode(" 缁撴瀯鍥惧眰 "),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((h3StructureFillMode) = $event),
                                onChange: onH3StructureFillModeChange,
                                style: {"padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                              }, [
                                _createElementVNode("option", { value: "gi_z" }, "Gi*锛圸-score 杩炵画锛"),
                                _createElementVNode("option", { value: "lisa_i" }, "LISA锛圠MiIndex 杩炵画锛")
                              ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [_vModelSelect, h3StructureFillMode]
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3AnalysisGridFeatures.length > 0 && (h3MainStage === 'diagnosis' || h3MainStage === 'evaluate'))
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 4,
                            class: "filter-section h3-control-row h3-control-row-tight",
                            style: {"margin-top":"8px"}
                          }, [
                            _createElementVNode("label", { style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"} }, [
                              _createTextVNode(" TopN "),
                              _withDirectives(_createElementVNode("input", {
                                type: "number",
                                min: "3",
                                max: "30",
                                step: "1",
                                "onUpdate:modelValue": $event => ((h3DecisionTopN) = $event),
                                onChange: onH3DecisionSettingsChange,
                                style: {"width":"68px","padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [
                                  _vModelText,
                                  h3DecisionTopN,
                                  void 0,
                                  { number: true }
                                ]
                              ])
                            ]),
                            (h3SubTab === 'lq' || h3SubTab === 'gap')
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 0,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"}
                                }, [
                                  _createTextVNode(" 鐩爣涓氭€? "),
                                  _withDirectives(_createElementVNode("select", {
                                    "onUpdate:modelValue": $event => ((h3TargetCategory) = $event),
                                    onChange: onH3DecisionSettingsChange,
                                    style: {"padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3CategoryMeta, (item) => {
                                      return (_openBlock(), _createElementBlock("option", {
                                        key: `target-${item.key}`,
                                        value: item.key
                                      }, _toDisplayString(item.label), 9 /* TEXT, PROPS */, ["value"]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [_vModelSelect, h3TargetCategory]
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("label", { class: "h3-check-chip h3-check-chip-compact" }, [
                              _withDirectives(_createElementVNode("input", {
                                type: "checkbox",
                                "onUpdate:modelValue": $event => ((h3OnlySignificant) = $event),
                                onChange: onH3DecisionSettingsChange
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [_vModelCheckbox, h3OnlySignificant]
                              ]),
                              _createTextVNode(" 浠呯粨鏋勭綉鏍? ")
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'analysis' && h3SubTab === 'metric_map' && h3AnalysisSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 5,
                            style: {"margin-top":"10px","display":"grid","grid-template-columns":"1fr 1fr","gap":"8px"}
                          }, [
                            _createElementVNode("div", { class: "count-badge" }, "POI鎬绘暟 " + _toDisplayString(h3AnalysisSummary.poi_count), 1 /* TEXT */),
                            _createElementVNode("div", { class: "count-badge" }, "骞冲潎瀵嗗害 " + _toDisplayString(h3AnalysisSummary.avg_density_poi_per_km2.toFixed(2)), 1 /* TEXT */),
                            _createElementVNode("div", { class: "count-badge" }, "骞冲潎鐔?" + _toDisplayString(h3AnalysisSummary.avg_local_entropy.toFixed(3)), 1 /* TEXT */),
                            _createElementVNode("div", { class: "count-badge" }, "缃戞牸鏁?" + _toDisplayString(h3AnalysisSummary.grid_count ?? h3GridCount), 1 /* TEXT */),
                            _createElementVNode("div", { class: "count-badge" }, "Gi*鏈夋晥鏍?" + _toDisplayString((h3AnalysisSummary.gi_z_stats && h3AnalysisSummary.gi_z_stats.count) ?? 0), 1 /* TEXT */),
                            _createElementVNode("div", { class: "count-badge" }, "LISA鏈夋晥鏍?" + _toDisplayString((h3AnalysisSummary.lisa_i_stats && h3AnalysisSummary.lisa_i_stats.count) ?? 0), 1 /* TEXT */)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'analysis' && h3SubTab === 'metric_map' && h3AnalysisSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 6,
                            class: "h3-analysis-hint"
                          }, " 鐪嬪瘑搴︺€佹贩鍚堝害鍜岄偦鍩熷樊鍊硷紝浼樺厛鎵锯€滈珮瀵嗕笖閭诲煙涓烘鈥濈殑杩炵画鐗囧尯銆? "))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage !== 'params' && h3Legend && h3Legend.items && h3Legend.items.length)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 7,
                            style: {"margin-top":"10px","border":"1px solid #eef1f4","border-radius":"8px","padding":"8px 10px","background":"#fafbfc"}
                          }, [
                            _createElementVNode("div", { style: {"font-size":"12px","color":"#374151","font-weight":"600","margin-bottom":"6px"} }, [
                              _createTextVNode(_toDisplayString(h3Legend.title) + " ", 1 /* TEXT */),
                              _createElementVNode("span", { style: {"color":"#6b7280","font-weight":"400"} }, _toDisplayString(h3Legend.unit ? `（${h3Legend.unit}）` : ''), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", { style: {"display":"grid","grid-template-columns":"1fr 1fr","gap":"6px 10px"} }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3Legend.items, (item, idx) => {
                                return (_openBlock(), _createElementBlock("div", {
                                  key: `legend-${idx}`,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"11px","color":"#4b5563"}
                                }, [
                                  _createElementVNode("span", {
                                    style: _normalizeStyle({display:'inline-block', width:'12px', height:'12px', borderRadius:'2px', background:item.color, border:'1px solid #d1d5db'})
                                  }, null, 4 /* STYLE */),
                                  _createElementVNode("span", null, _toDisplayString(item.label), 1 /* TEXT */)
                                ]))
                              }), 128 /* KEYED_FRAGMENT */))
                            ]),
                            (h3Legend.noDataLabel)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  style: {"margin-top":"6px","font-size":"11px","color":"#6b7280","display":"flex","align-items":"center","gap":"6px"}
                                }, [
                                  _createElementVNode("span", {
                                    style: _normalizeStyle({display:'inline-block', width:'12px', height:'12px', borderRadius:'2px', background:h3Legend.noDataColor || '#d1d5db', border:'1px solid #d1d5db'})
                                  }, null, 4 /* STYLE */),
                                  _createElementVNode("span", null, _toDisplayString(h3Legend.noDataLabel), 1 /* TEXT */)
                                ]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'analysis' && h3SubTab === 'metric_map' && h3AnalysisSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 8,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", {
                              id: "h3CategoryChart",
                              style: {"height":"180px"}
                            }),
                            _createElementVNode("div", {
                              id: "h3DensityChart",
                              style: {"height":"180px","margin-top":"8px"}
                            })
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'analysis' && h3SubTab === 'structure_map' && h3DerivedStats.structureSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 9,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "h3-analysis-hint" }, " 缁撴瀯鍥惧彛寰勶細浠呬娇鐢?ArcGIS 杩炵画瀛楁銆侴i* 浣跨敤 GiZScore锛汱ISA 浣跨敤 LMiIndex锛涚綉鏍艰竟妗嗙粺涓€钃濊壊銆? "),
                            h3AnalysisSummary
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  style: {"margin-top":"10px","display":"grid","grid-template-columns":"1fr 1fr","gap":"8px"}
                                }, [
                                  _createElementVNode("div", { class: "count-badge" }, "鑾叞鎸囨暟 " + _toDisplayString(h3AnalysisSummary.global_moran_i_density ?? 'N/A'), 1 /* TEXT */),
                                  _createElementVNode("div", { class: "count-badge" }, "鑾叞z鍊?" + _toDisplayString(h3AnalysisSummary.global_moran_z_score ?? 'N/A'), 1 /* TEXT */),
                                  (h3StructureFillMode === 'gi_z')
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "count-badge"
                                      }, " Gi*鏈夋晥鏍?" + _toDisplayString((h3AnalysisSummary.gi_z_stats && h3AnalysisSummary.gi_z_stats.count) ?? 0), 1 /* TEXT */))
                                    : (_openBlock(), _createElementBlock("div", {
                                        key: 1,
                                        class: "count-badge"
                                      }, " LISA鏈夋晥鏍?" + _toDisplayString((h3AnalysisSummary.lisa_i_stats && h3AnalysisSummary.lisa_i_stats.count) ?? 0), 1 /* TEXT */)),
                                  _createElementVNode("div", { class: "count-badge" }, "寮曟搸 " + _toDisplayString((h3AnalysisSummary.analysis_engine || 'pysal').toUpperCase()), 1 /* TEXT */)
                                ]))
                              : _createCommentVNode("v-if", true),
                            (h3DerivedStats.structureSummary.lisaRenderMeta && h3DerivedStats.structureSummary.lisaRenderMeta.degraded)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 1,
                                  class: "h3-analysis-hint",
                                  style: {"margin-top":"8px"}
                                }, _toDisplayString(h3DerivedStats.structureSummary.lisaRenderMeta.message || 'LMiIndex鏂瑰樊涓嶈冻'), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true),
                            (h3AnalysisSummary && h3AnalysisSummary.arcgis_status)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 2,
                                  class: "h3-analysis-hint",
                                  style: {"margin-top":"8px"}
                                }, _toDisplayString(h3AnalysisSummary.arcgis_status), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true),
                            h3AnalysisSummary
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 3,
                                  style: {"margin-top":"8px","display":"flex","justify-content":"flex-end"}
                                }, [
                                  _createElementVNode("button", {
                                    type: "button",
                                    class: "btn-outline btn-compact",
                                    disabled: isComputingH3Analysis || isGeneratingH3ArcgisSnapshot,
                                    onClick: generateH3ArcgisSnapshot
                                  }, _toDisplayString(isGeneratingH3ArcgisSnapshot ? '鐢熸垚蹇収涓?..' : '鐢熸垚缁撴瀯蹇収'), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                                ]))
                              : _createCommentVNode("v-if", true),
                            (h3AnalysisSummary && !getArcgisSnapshotUrl())
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 4,
                                  class: "h3-analysis-hint",
                                  style: {"margin-top":"8px"}
                                }, " 褰撳墠鏈敓鎴愮粨鏋勫揩鐓э紝鍙偣鍑烩€滅敓鎴愮粨鏋勫揩鐓р€濇寜闇€鐢熸垚銆? "))
                              : _createCommentVNode("v-if", true),
                            (h3AnalysisSummary && getArcgisSnapshotUrl())
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 5,
                                  style: {"margin-top":"10px","border":"1px solid #eef1f4","border-radius":"10px","padding":"8px","background":"#fafbfc"}
                                }, [
                                  _createElementVNode("div", { style: {"font-size":"12px","color":"#374151","font-weight":"600","margin-bottom":"6px"} }, _toDisplayString(getArcgisSnapshotTitle()), 1 /* TEXT */),
                                  _createElementVNode("img", {
                                    src: getArcgisSnapshotSrc(),
                                    onLoad: $event => (h3ArcgisSnapshotLoadError = false),
                                    onError: $event => (h3ArcgisSnapshotLoadError = true),
                                    alt: "ArcGIS缁撴瀯鍥?",
                                    style: {"width":"100%","border-radius":"8px","border":"1px solid #dbe2ea"}
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["src", "onLoad", "onError"]),
                                  h3ArcgisSnapshotLoadError
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "h3-analysis-hint",
                                        style: {"margin-top":"8px"}
                                      }, " ArcGIS缁撴瀯蹇収鍔犺浇澶辫触锛岃閲嶇畻涓€娆℃垨鍒囨崲缁撴瀯鍥惧眰鍚庨噸璇曘€? "))
                                    : _createCommentVNode("v-if", true)
                                ]))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("div", { class: "h3-decision-cards" }, [
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "Gi* 鍧囧€"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.structureSummary.giZStats.mean === null ? '-' : h3DerivedStats.structureSummary.giZStats.mean.toFixed(2)), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "Gi* 涓綅鏁"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.structureSummary.giZStats.p50 === null ? '-' : h3DerivedStats.structureSummary.giZStats.p50.toFixed(2)), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "LISA 姝ｅ€煎崰姣"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.structureSummary.lisaPositivePct === null ? '-' : `${(h3DerivedStats.structureSummary.lisaPositivePct * 100).toFixed(1)}%`), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "LISA 璐熷€煎崰姣"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.structureSummary.lisaNegativePct === null ? '-' : `${(h3DerivedStats.structureSummary.lisaNegativePct * 100).toFixed(1)}%`), 1 /* TEXT */)
                              ])
                            ]),
                            _createElementVNode("div", {
                              id: "h3StructureChart",
                              style: {"height":"180px"}
                            }),
                            _createElementVNode("table", {
                              class: "h3-mini-table",
                              style: {"margin-top":"8px"}
                            }, [
                              _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "H3"),
                                  _createElementVNode("th", null, "Gi*z"),
                                  _createElementVNode("th", null, "LISA I"),
                                  _createElementVNode("th", null, "缁撴瀯淇″彿"),
                                  _createElementVNode("th", null, "瀵嗗害")
                                ])
                              ]),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3DerivedStats.structureSummary.rows.slice(0, h3DecisionTopN), (row) => {
                                  return (_openBlock(), _createElementBlock("tr", {
                                    key: `structure-${row.h3_id}`,
                                    class: _normalizeClass({ 'h3-row-active': row.h3_id === selectedH3Id })
                                  }, [
                                    _createElementVNode("td", null, [
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "h3-id-btn",
                                        title: row.h3_id,
                                        onClick: $event => (focusGridByH3Id(row.h3_id))
                                      }, _toDisplayString(shortH3Id(row.h3_id)), 9 /* TEXT, PROPS */, ["title", "onClick"])
                                    ]),
                                    _createElementVNode("td", null, _toDisplayString(row.gi_star_z_score === null ? '-' : row.gi_star_z_score.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.lisa_i === null ? '-' : row.lisa_i.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(Number.isFinite(row.structure_signal) ? row.structure_signal.toFixed(2) : '-'), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.density === null ? '-' : row.density.toFixed(2)), 1 /* TEXT */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'diagnosis' && h3SubTab === 'typing' && h3DerivedStats.typingSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 10,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "h3-analysis-hint" }, " 鐪嬪洓璞￠檺缁撴瀯锛氶珮瀵嗛珮娣峰悎鍋忔垚鐔燂紝楂樺瘑浣庢贩鍚堝亸鍗曟牳锛屼綆瀵嗛珮娣峰悎鍋忔綔鍔涳紝浣庡瘑浣庢贩鍚堝亸钖勫急锛涘悓鏃跺弬鑰冨彲淇″害銆? "),
                            _createElementVNode("div", { class: "h3-decision-cards" }, [
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "鏈轰細缃戞牸鏁"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.typingSummary.opportunityCount), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "鏈€楂樺瘑搴"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.typingSummary.maxDensity.toFixed(2)), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "寤鸿鍔ㄤ綔"),
                                _createElementVNode("div", { class: "value small" }, _toDisplayString(h3DerivedStats.typingSummary.recommendation), 1 /* TEXT */)
                              ])
                            ]),
                            _createElementVNode("table", { class: "h3-mini-table" }, [
                              _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "H3"),
                                  _createElementVNode("th", null, "POI"),
                                  _createElementVNode("th", null, "瀵嗗害"),
                                  _createElementVNode("th", null, "鐔"),
                                  _createElementVNode("th", null, "鍙俊搴"),
                                  _createElementVNode("th", null, "鍒嗗瀷")
                                ])
                              ]),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3DerivedStats.typingSummary.rows.slice(0, h3DecisionTopN), (row) => {
                                  return (_openBlock(), _createElementBlock("tr", {
                                    key: `typing-${row.h3_id}`,
                                    class: _normalizeClass({ 'h3-row-active': row.h3_id === selectedH3Id })
                                  }, [
                                    _createElementVNode("td", null, [
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "h3-id-btn",
                                        title: row.h3_id,
                                        onClick: $event => (focusGridByH3Id(row.h3_id))
                                      }, _toDisplayString(shortH3Id(row.h3_id)), 9 /* TEXT, PROPS */, ["title", "onClick"])
                                    ]),
                                    _createElementVNode("td", null, _toDisplayString(row.poi_count), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.density.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.entropy_norm === null ? '-' : row.entropy_norm.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString((row.confidence && row.confidence.label) || '浣? '), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.type_label), 1 /* TEXT */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'diagnosis' && h3SubTab === 'lq' && h3DerivedStats.lqSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 11,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "h3-analysis-hint" }, " 鐪嬬洰鏍囦笟鎬佺浉瀵规湰鍒嗘瀽鍖烘槸鍚︽洿寮猴細澶т簬1鍋忓己锛屽皬浜?鍋忓急锛涘凡鍋氬皬鏍锋湰骞虫粦銆? "),
                            _createElementVNode("div", { class: "h3-decision-cards" }, [
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "浼樺娍缃戞牸鏁"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.lqSummary.opportunityCount), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "鏈€楂樹紭鍔垮€"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.lqSummary.maxLq.toFixed(2)), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "寤鸿涓氭€"),
                                _createElementVNode("div", { class: "value small" }, _toDisplayString(h3DerivedStats.lqSummary.recommendation), 1 /* TEXT */)
                              ])
                            ]),
                            _createElementVNode("div", {
                              id: "h3LqChart",
                              style: {"height":"180px"}
                            }),
                            _createElementVNode("table", {
                              class: "h3-mini-table",
                              style: {"margin-top":"8px"}
                            }, [
                              _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "H3"),
                                  _createElementVNode("th", null, "POI"),
                                  _createElementVNode("th", null, "瀵嗗害"),
                                  _createElementVNode("th", null, "鐔"),
                                  _createElementVNode("th", null, "鍙俊搴"),
                                  _createElementVNode("th", null, "缁撴瀯鍙傝€"),
                                  _createElementVNode("th", null, "浼樺娍鍊")
                                ])
                              ]),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3DerivedStats.lqSummary.rows.slice(0, h3DecisionTopN), (row) => {
                                  return (_openBlock(), _createElementBlock("tr", {
                                    key: `lq-${row.h3_id}`,
                                    class: _normalizeClass({ 'h3-row-active': row.h3_id === selectedH3Id })
                                  }, [
                                    _createElementVNode("td", null, [
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "h3-id-btn",
                                        title: row.h3_id,
                                        onClick: $event => (focusGridByH3Id(row.h3_id))
                                      }, _toDisplayString(shortH3Id(row.h3_id)), 9 /* TEXT, PROPS */, ["title", "onClick"])
                                    ]),
                                    _createElementVNode("td", null, _toDisplayString(row.poi_count), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.density.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.entropy_norm === null ? '-' : row.entropy_norm.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString((row.confidence && row.confidence.label) || '浣? '), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(Number.isFinite(row.structure_signal) ? row.structure_signal.toFixed(2) : '-'), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.lq_target === null ? '-' : row.lq_target.toFixed(2)), 1 /* TEXT */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (h3MainStage === 'evaluate' && h3SubTab === 'gap' && h3DerivedStats.gapSummary)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 12,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "h3-analysis-hint" }, " 鍏堢湅鈥滈渶姹傚垎浣嶁€濆拰鈥滀緵缁欏垎浣嶁€濓紝鍐嶇湅涓よ€呭樊鍊硷紱闇€姹傞珮涓斾緵缁欎綆鐨勭綉鏍间紭鍏堣ˉ浣嶃€? "),
                            (h3DerivedStats.gapSummary.mappingWarning)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "panel-placeholder",
                                  style: {"margin-top":"8px","border-color":"#fde68a","background":"#fffbeb","color":"#92400e"}
                                }, _toDisplayString(h3DerivedStats.gapSummary.mappingWarning), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("div", { class: "h3-decision-cards" }, [
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "楂樼己鍙ｇ綉鏍"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.gapSummary.opportunityCount), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "鏈€楂樼己鍙ｅ垎"),
                                _createElementVNode("div", { class: "value" }, _toDisplayString(h3DerivedStats.gapSummary.maxGap.toFixed(2)), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "h3-decision-card" }, [
                                _createElementVNode("div", { class: "label" }, "寤鸿浼樺厛鍖"),
                                _createElementVNode("div", { class: "value small" }, _toDisplayString(h3DerivedStats.gapSummary.recommendation), 1 /* TEXT */)
                              ])
                            ]),
                            _createElementVNode("div", {
                              class: "panel-placeholder",
                              style: {"margin-top":"8px"}
                            }, _toDisplayString(h3DerivedStats.gapSummary.insight || '缂哄彛鍒?= 闇€姹傜櫨鍒嗕綅 - 鐩爣涓氭€佷緵缁欑櫨鍒嗕綅锛堣秺楂樿秺鍙兘渚涚粰鍋忓急锛? '), 1 /* TEXT */),
                            _createElementVNode("div", {
                              id: "h3GapChart",
                              style: {"height":"180px","margin-top":"8px"}
                            }),
                            _createElementVNode("table", {
                              class: "h3-mini-table",
                              style: {"margin-top":"8px"}
                            }, [
                              _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "H3"),
                                  _createElementVNode("th", null, "闇€姹傚垎浣"),
                                  _createElementVNode("th", null, "渚涚粰鍒嗕綅"),
                                  _createElementVNode("th", null, "缂哄彛鍒"),
                                  _createElementVNode("th", null, "鍙俊搴"),
                                  _createElementVNode("th", null, "缁撹")
                                ])
                              ]),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3DerivedStats.gapSummary.rows.slice(0, h3DecisionTopN), (row) => {
                                  return (_openBlock(), _createElementBlock("tr", {
                                    key: `gap-${row.h3_id}`,
                                    class: _normalizeClass({ 'h3-row-active': row.h3_id === selectedH3Id })
                                  }, [
                                    _createElementVNode("td", null, [
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "h3-id-btn",
                                        title: row.h3_id,
                                        onClick: $event => (focusGridByH3Id(row.h3_id))
                                      }, _toDisplayString(shortH3Id(row.h3_id)), 9 /* TEXT, PROPS */, ["title", "onClick"])
                                    ]),
                                    _createElementVNode("td", null, _toDisplayString(Math.round((row.demand_pct || 0) * 100)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(Math.round((row.supply_pct || 0) * 100)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.gap_score === null ? '-' : row.gap_score.toFixed(2)), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString((row.confidence && row.confidence.label) || '浣? '), 1 /* TEXT */),
                                    _createElementVNode("td", null, _toDisplayString(row.gap_zone_label || '-'), 1 /* TEXT */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      h3GridStatus
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 13,
                            class: "status-text",
                            style: {"margin-top":"10px","display":"flex","align-items":"center","gap":"8px","justify-content":"flex-start"}
                          }, [
                            _createElementVNode("span", null, _toDisplayString(h3GridStatus), 1 /* TEXT */),
                            selectedH3Id
                              ? (_openBlock(), _createElementBlock("button", {
                                  key: 0,
                                  type: "button",
                                  style: {"border":"1px solid #d9dee7","background":"#fff","color":"#4b5563","border-radius":"999px","padding":"2px 8px","font-size":"11px","cursor":"pointer"},
                                  onClick: clearGridLock
                                }, " 鍙栨秷閿佸畾 ", 8 /* PROPS */, ["onClick"]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : _createCommentVNode("v-if", true)
                    ], 512 /* NEED_PATCH */), [
                      [_vShow, poiSubTab === 'grid']
                    ])
                  ], 512 /* NEED_PATCH */), [
                    [_vShow, activeStep3Panel === 'poi']
                  ]),
                  _withDirectives(_createElementVNode("div", { class: "panel poi-panel" }, [
                    _createElementVNode("div", { class: "poi-subpanel" }, [
                      populationOverview
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "h3-subtabs population-view-tabs"
                          }, [
                            _createElementVNode("button", {
                              type: "button",
                              class: _normalizeClass(["h3-subtab-pill", { active: populationAnalysisView === 'density' }]),
                              onClick: $event => (setPopulationAnalysisView('density'))
                            }, "瀵嗗害", 10 /* CLASS, PROPS */, ["onClick"]),
                            _createElementVNode("button", {
                              type: "button",
                              class: _normalizeClass(["h3-subtab-pill", { active: populationAnalysisView === 'sex' }]),
                              onClick: $event => (setPopulationAnalysisView('sex'))
                            }, "鎬у埆缁撴瀯", 10 /* CLASS, PROPS */, ["onClick"]),
                            _createElementVNode("button", {
                              type: "button",
                              class: _normalizeClass(["h3-subtab-pill", { active: populationAnalysisView === 'age' }]),
                              onClick: $event => (setPopulationAnalysisView('age'))
                            }, "骞撮緞", 10 /* CLASS, PROPS */, ["onClick"])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (populationMeta && getPopulationYearOptions().length)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "population-view-control-row"
                          }, [
                            _createElementVNode("label", { class: "population-inline-field" }, [
                              _createElementVNode("span", null, "骞翠唤"),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((populationSelectedYear) = $event),
                                onChange: onPopulationYearChange,
                                class: "h3-params-select"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getPopulationYearOptions(), (item) => {
                                  return (_openBlock(), _createElementBlock("option", {
                                    key: `population-year-${item.value}`,
                                    value: item.value
                                  }, _toDisplayString(item.label), 9 /* TEXT, PROPS */, ["value"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [_vModelSelect, populationSelectedYear]
                              ])
                            ]),
                            (populationAnalysisView === 'sex')
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 0,
                                  class: "population-inline-field"
                                }, [
                                  _createElementVNode("span", null, "鍦板浘鍥惧眰"),
                                  _withDirectives(_createElementVNode("select", {
                                    "onUpdate:modelValue": $event => ((populationSexMetricMode) = $event),
                                    onChange: onPopulationSexMetricModeChange,
                                    class: "h3-params-select"
                                  }, [
                                    _createElementVNode("option", { value: "ratio" }, "鎬у埆鍗犳瘮锛?锛"),
                                    _createElementVNode("option", { value: "diff" }, "鎬у埆宸紓锛堜汉锛")
                                  ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [_vModelSelect, populationSexMetricMode]
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (populationLayer && populationLayer.legend)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "population-legend-card",
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "population-legend-title" }, [
                              _createTextVNode(_toDisplayString(populationLayer.legend.title) + " ", 1 /* TEXT */),
                              _createElementVNode("span", { style: {"color":"#6b7280","font-weight":"400"} }, _toDisplayString(populationLayer.legend.unit ? `（${populationLayer.legend.unit}）` : ''), 1 /* TEXT */)
                            ]),
                            (populationLayer.legend.kind !== 'categorical')
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "population-legend-gradient",
                                  style: _normalizeStyle(getPopulationLegendGradientStyle())
                                }, null, 4 /* STYLE */))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("div", { class: "population-legend-grid" }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(populationLayer.legend.stops, (item, idx) => {
                                return (_openBlock(), _createElementBlock("div", {
                                  key: `population-legend-${idx}`,
                                  class: "population-legend-item"
                                }, [
                                  _createElementVNode("span", {
                                    class: "population-legend-swatch",
                                    style: _normalizeStyle({ background:item.color })
                                  }, null, 4 /* STYLE */),
                                  _createElementVNode("span", null, _toDisplayString(item.label || (populationLayer.legend.unit === '浜?骞虫柟鍏噷'
                                                            ? formatPopulationDensity(item.value)
                                                            : (populationLayer.legend.unit === '%'
                                                                ? formatPopulationLegendPercent(item.value)
                                                                : formatPopulationValue(item.value)))), 1 /* TEXT */)
                                ]))
                              }), 128 /* KEYED_FRAGMENT */))
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      populationOverview
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 3,
                            class: "population-analysis-grid",
                            style: {"margin-top":"10px"}
                          }, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getPopulationSummaryRows(), (row) => {
                              return (_openBlock(), _createElementBlock("div", {
                                key: `population-card-${row.key}`,
                                class: "population-analysis-card"
                              }, [
                                _createElementVNode("div", { class: "population-analysis-card-label" }, _toDisplayString(row.label), 1 /* TEXT */),
                                _createElementVNode("div", { class: "population-analysis-card-value" }, _toDisplayString(row.value), 1 /* TEXT */)
                              ]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ]))
                        : _createCommentVNode("v-if", true),
                      populationOverview
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 4,
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", {
                              id: "populationPrimaryChart",
                              style: _normalizeStyle({ height: populationAnalysisView === 'age' ? '240px' : '200px' })
                            }, null, 4 /* STYLE */),
                            (populationAnalysisView !== 'age')
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  id: "populationSecondaryChart",
                                  style: {"height":"220px","margin-top":"8px"}
                                }))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : (_openBlock(), _createElementBlock("div", {
                            key: 5,
                            class: "panel-placeholder",
                            style: {"margin-top":"10px"}
                          }, _toDisplayString(isComputingPopulation ? '姝ｅ湪鑷姩璁＄畻浜哄彛鍒嗘瀽...' : '杩涘叆浜哄彛闈㈡澘鍚庝細鑷姩璁＄畻骞跺睍绀虹粨鏋溿€? '), 1 /* TEXT */))
                    ])
                  ], 512 /* NEED_PATCH */), [
                    [_vShow, activeStep3Panel === 'population']
                  ]),
                  _withDirectives(_createElementVNode("div", { class: "panel poi-panel" }, [
                    _createElementVNode("div", { class: "poi-subpanel" }, [
                      nightlightOverview
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "h3-subtabs population-view-tabs"
                          }, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getNightlightViewOptions(), (item) => {
                              return (_openBlock(), _createElementBlock("button", {
                                type: "button",
                                class: _normalizeClass(["h3-subtab-pill", { active: nightlightAnalysisView === item.value }]),
                                key: `nightlight-view-${item.value}`,
                                onClick: $event => (setNightlightAnalysisView(item.value))
                              }, _toDisplayString(item.label), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ]))
                        : _createCommentVNode("v-if", true),
                      (nightlightMeta && getNightlightYearOptions().length)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "population-view-control-row"
                          }, [
                            _createElementVNode("label", { class: "population-inline-field" }, [
                              _createElementVNode("span", null, "骞翠唤"),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((nightlightSelectedYear) = $event),
                                onChange: onNightlightYearChange,
                                class: "h3-params-select"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getNightlightYearOptions(), (item) => {
                                  return (_openBlock(), _createElementBlock("option", {
                                    key: `nightlight-year-${item.year}`,
                                    value: item.year
                                  }, _toDisplayString(item.label), 9 /* TEXT, PROPS */, ["value"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [_vModelSelect, nightlightSelectedYear]
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      (nightlightLayer && nightlightLayer.legend)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "population-legend-card",
                            style: {"margin-top":"10px"}
                          }, [
                            _createElementVNode("div", { class: "population-legend-title" }, [
                              _createTextVNode(_toDisplayString(nightlightLayer.legend.title) + " ", 1 /* TEXT */),
                              _createElementVNode("span", { style: {"color":"#6b7280","font-weight":"400"} }, _toDisplayString(nightlightLayer.legend.kind !== 'categorical' && nightlightLayer.legend.unit ? `（${nightlightLayer.legend.unit}）` : ''), 1 /* TEXT */)
                            ]),
                            (nightlightLayer.legend.kind !== 'categorical')
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "population-legend-gradient",
                                  style: _normalizeStyle(getNightlightLegendGradientStyle())
                                }, null, 4 /* STYLE */))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("div", { class: "population-legend-grid" }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(nightlightLayer.legend.stops, (item, idx) => {
                                return (_openBlock(), _createElementBlock("div", {
                                  key: `nightlight-legend-${idx}`,
                                  class: "population-legend-item"
                                }, [
                                  _createElementVNode("span", {
                                    class: "population-legend-swatch",
                                    style: _normalizeStyle({ background:item.color })
                                  }, null, 4 /* STYLE */),
                                  _createElementVNode("span", null, _toDisplayString(nightlightLayer.legend.kind === 'categorical' ? (item.label || '-') : formatNightlightValue(item.value, 2)), 1 /* TEXT */)
                                ]))
                              }), 128 /* KEYED_FRAGMENT */))
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      nightlightOverview
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 3,
                            class: "population-analysis-grid",
                            style: {"margin-top":"10px"}
                          }, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getNightlightSummaryRows(), (row) => {
                              return (_openBlock(), _createElementBlock("div", {
                                key: `nightlight-card-${row.key}`,
                                class: "population-analysis-card"
                              }, [
                                _createElementVNode("div", { class: "population-analysis-card-label" }, _toDisplayString(row.label), 1 /* TEXT */),
                                _createElementVNode("div", { class: "population-analysis-card-value" }, _toDisplayString(row.value), 1 /* TEXT */)
                              ]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ]))
                        : _createCommentVNode("v-if", true),
                      (!nightlightOverview)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 4,
                            class: "panel-placeholder",
                            style: {"margin-top":"10px"}
                          }, _toDisplayString(isComputingNightlight ? '姝ｅ湪鑷姩璁＄畻澶滃厜鍒嗘瀽...' : '杩涘叆澶滃厜闈㈡澘鍚庝細鑷姩璁＄畻骞跺睍绀虹粨鏋溿€? '), 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
                    ])
                  ], 512 /* NEED_PATCH */), [
                    [_vShow, activeStep3Panel === 'nightlight']
                  ]),
                  _withDirectives(_createElementVNode("div", { class: "panel" }, [
                    _createElementVNode("h4", null, "璺綉鍒嗘瀽"),
                    _createElementVNode("div", {
                      class: "h3-subtabs",
                      style: {"margin-top":"8px"}
                    }, [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roadSyntaxTabs, (tab) => {
                        return (_openBlock(), _createElementBlock("button", {
                          type: "button",
                          class: _normalizeClass(["h3-subtab-pill", { active: roadSyntaxMainTab === tab.value }]),
                          key: `road-syntax-tab-${tab.value}`,
                          disabled: tab.value !== 'params' && !canActivateRoadSyntaxTab(tab.value),
                          onClick: $event => (setRoadSyntaxMainTab(tab.value))
                        }, _toDisplayString(tab.label), 11 /* TEXT, CLASS, PROPS */, ["disabled", "onClick"]))
                      }), 128 /* KEYED_FRAGMENT */))
                    ]),
                    (roadSyntaxMainTab === 'params')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "h3-params-card",
                          style: {"margin-top":"10px"}
                        }, [
                          _createElementVNode("div", { class: "h3-params-grid" }, [
                            _createElementVNode("label", { class: "h3-params-field" }, [
                              _createElementVNode("span", { class: "h3-params-label" }, "鎸囨爣棰勮"),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((roadSyntaxLastMetricTab) = $event),
                                class: "h3-params-select"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roadSyntaxMetricTabs(), (tab) => {
                                  return (_openBlock(), _createElementBlock("option", {
                                    key: `road-syntax-pref-${tab.value}`,
                                    value: tab.value
                                  }, _toDisplayString(tab.label), 9 /* TEXT, PROPS */, ["value"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                                [_vModelSelect, roadSyntaxLastMetricTab]
                              ])
                            ]),
                            _createElementVNode("label", { class: "h3-params-field" }, [
                              _createElementVNode("span", { class: "h3-params-label" }, "鍥炬ā鍨"),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((roadSyntaxGraphModel) = $event),
                                class: "h3-params-select"
                              }, [
                                _createElementVNode("option", { value: "segment" }, "绾挎鍥撅紙Segment锛"),
                                _createElementVNode("option", { value: "axial" }, "杞寸嚎鍥撅紙Axial锛")
                              ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                                [_vModelSelect, roadSyntaxGraphModel]
                              ])
                            ]),
                            _createElementVNode("label", { class: "h3-params-field" }, [
                              _createElementVNode("span", { class: "h3-params-label" }, "瀹樻柟鑹插甫"),
                              _withDirectives(_createElementVNode("select", {
                                "onUpdate:modelValue": $event => ((roadSyntaxDepthmapColorScale) = $event),
                                class: "h3-params-select"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roadSyntaxDepthmapColorScaleOptions(), (opt) => {
                                  return (_openBlock(), _createElementBlock("option", {
                                    key: `road-syntax-color-scale-${opt.value}`,
                                    value: opt.value
                                  }, _toDisplayString(opt.label), 9 /* TEXT, PROPS */, ["value"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                                [_vModelSelect, roadSyntaxDepthmapColorScale]
                              ])
                            ]),
                            _createElementVNode("label", { class: "h3-params-field" }, [
                              _createElementVNode("span", { class: "h3-params-label" }, "Blue 闃堝€"),
                              _withDirectives(_createElementVNode("input", {
                                "onUpdate:modelValue": $event => ((roadSyntaxDisplayBlue) = $event),
                                type: "number",
                                min: "0",
                                max: "1",
                                step: "0.01",
                                class: "h3-params-select",
                                onChange: onRoadSyntaxDisplayRangeChange
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [
                                  _vModelText,
                                  roadSyntaxDisplayBlue,
                                  void 0,
                                  { number: true }
                                ]
                              ])
                            ]),
                            _createElementVNode("label", { class: "h3-params-field" }, [
                              _createElementVNode("span", { class: "h3-params-label" }, "Red 闃堝€"),
                              _withDirectives(_createElementVNode("input", {
                                "onUpdate:modelValue": $event => ((roadSyntaxDisplayRed) = $event),
                                type: "number",
                                min: "0",
                                max: "1",
                                step: "0.01",
                                class: "h3-params-select",
                                onChange: onRoadSyntaxDisplayRangeChange
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                [
                                  _vModelText,
                                  roadSyntaxDisplayRed,
                                  void 0,
                                  { number: true }
                                ]
                              ])
                            ])
                          ]),
                          _createElementVNode("div", { class: "h3-params-chips" }, [
                            _createElementVNode("span", { class: "count-badge" }, "娓叉煋妗ｄ綅 " + _toDisplayString(roadSyntaxPerformanceProfile), 1 /* TEXT */),
                            _createElementVNode("span", { class: "count-badge" }, "杈规涓婇檺 " + _toDisplayString(roadSyntaxActiveEdgeCap == null ? '鏃犻檺鍒? : roadSyntaxActiveEdgeCap '), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "h3-params-actions" }, [
                            _createElementVNode("button", {
                              class: "h3-btn h3-btn-primary h3-params-compute-btn",
                              disabled: isComputingRoadSyntax || !lastIsochroneGeoJSON,
                              onClick: computeRoadSyntax
                            }, _toDisplayString(isComputingRoadSyntax ? '璁＄畻涓?..' : '璁＄畻璺綉鎸囨爣'), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                          ])
                        ]))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          style: {"margin-top":"10px"}
                        }, [
                          _createElementVNode("div", { style: {"display":"flex","align-items":"center","gap":"8px","flex-wrap":"wrap"} }, [
                            (roadSyntaxMetric !== 'intelligibility')
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 0,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"}
                                }, [
                                  _createTextVNode(" 鑹插甫 "),
                                  _withDirectives(_createElementVNode("select", {
                                    "onUpdate:modelValue": $event => ((roadSyntaxDepthmapColorScale) = $event),
                                    onChange: refreshRoadSyntaxOverlay,
                                    style: {"padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roadSyntaxDepthmapColorScaleOptions(), (opt) => {
                                      return (_openBlock(), _createElementBlock("option", {
                                        key: `road-syntax-color-scale-inline-${opt.value}`,
                                        value: opt.value
                                      }, _toDisplayString(opt.label), 9 /* TEXT, PROPS */, ["value"]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [_vModelSelect, roadSyntaxDepthmapColorScale]
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true),
                            (roadSyntaxMetric !== 'intelligibility')
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 1,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"}
                                }, [
                                  _createTextVNode(" Blue "),
                                  _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": $event => ((roadSyntaxDisplayBlue) = $event),
                                    type: "number",
                                    min: "0",
                                    max: "1",
                                    step: "0.01",
                                    onChange: onRoadSyntaxDisplayRangeChange,
                                    style: {"width":"64px","padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [
                                      _vModelText,
                                      roadSyntaxDisplayBlue,
                                      void 0,
                                      { number: true }
                                    ]
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true),
                            (roadSyntaxMetric !== 'intelligibility')
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 2,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"}
                                }, [
                                  _createTextVNode(" Red "),
                                  _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": $event => ((roadSyntaxDisplayRed) = $event),
                                    type: "number",
                                    min: "0",
                                    max: "1",
                                    step: "0.01",
                                    onChange: onRoadSyntaxDisplayRangeChange,
                                    style: {"width":"64px","padding":"4px 6px","border":"1px solid #ddd","border-radius":"6px","font-size":"12px"}
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                                    [
                                      _vModelText,
                                      roadSyntaxDisplayRed,
                                      void 0,
                                      { number: true }
                                    ]
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true),
                            (roadSyntaxMetricUsesRadius(roadSyntaxMetric))
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 3,
                                  style: {"display":"flex","align-items":"center","gap":"6px","font-size":"12px","color":"#666"}
                                }, [
                                  _createTextVNode(" 鍗婂緞 "),
                                  _createElementVNode("div", { style: {"display":"inline-flex","border":"1px solid #d1d5db","border-radius":"8px","overflow":"hidden"} }, [
                                    _createElementVNode("button", {
                                      type: "button",
                                      onClick: $event => (setRoadSyntaxRadiusLabel('global')),
                                      disabled: isComputingRoadSyntax,
                                      style: _normalizeStyle({
                                                            border:'0',
                                                            padding:'4px 10px',
                                                            fontSize:'12px',
                                                            cursor: isComputingRoadSyntax ? 'not-allowed' : 'pointer',
                                                            color: roadSyntaxRadiusLabel === 'global' ? '#fff' : '#374151',
                                                            background: roadSyntaxRadiusLabel === 'global' ? '#2563eb' : '#fff',
                                                            opacity: isComputingRoadSyntax ? 0.45 : 1
                                                        })
                                    }, "绛夋椂鍦堝唴", 12 /* STYLE, PROPS */, ["onClick", "disabled"]),
                                    _createElementVNode("button", {
                                      type: "button",
                                      onClick: $event => (setRoadSyntaxRadiusLabel('r600')),
                                      disabled: isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r600'),
                                      style: _normalizeStyle({
                                                            border:'0',
                                                            borderLeft:'1px solid #d1d5db',
                                                            padding:'4px 10px',
                                                            fontSize:'12px',
                                                            cursor: (isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r600')) ? 'not-allowed' : 'pointer',
                                                            color: roadSyntaxRadiusLabel === 'r600' ? '#fff' : '#374151',
                                                            background: roadSyntaxRadiusLabel === 'r600' ? '#2563eb' : '#fff',
                                                            opacity: (isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r600')) ? 0.45 : 1
                                                        })
                                    }, "600m", 12 /* STYLE, PROPS */, ["onClick", "disabled"]),
                                    _createElementVNode("button", {
                                      type: "button",
                                      onClick: $event => (setRoadSyntaxRadiusLabel('r800')),
                                      disabled: isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r800'),
                                      style: _normalizeStyle({
                                                            border:'0',
                                                            borderLeft:'1px solid #d1d5db',
                                                            padding:'4px 10px',
                                                            fontSize:'12px',
                                                            cursor: (isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r800')) ? 'not-allowed' : 'pointer',
                                                            color: roadSyntaxRadiusLabel === 'r800' ? '#fff' : '#374151',
                                                            background: roadSyntaxRadiusLabel === 'r800' ? '#2563eb' : '#fff',
                                                            opacity: (isComputingRoadSyntax || !roadSyntaxHasRadiusLabel('r800')) ? 0.45 : 1
                                                        })
                                    }, "800m", 12 /* STYLE, PROPS */, ["onClick", "disabled"])
                                  ])
                                ]))
                              : _createCommentVNode("v-if", true),
                            (roadSyntaxSupportsSkeleton(roadSyntaxMetric))
                              ? (_openBlock(), _createElementBlock("label", {
                                  key: 4,
                                  class: "h3-check-chip h3-check-chip-compact"
                                }, [
                                  _withDirectives(_createElementVNode("input", {
                                    type: "checkbox",
                                    "onUpdate:modelValue": $event => ((roadSyntaxSkeletonOnly) = $event),
                                    disabled: !canToggleRoadSyntaxSkeleton(),
                                    onChange: refreshRoadSyntaxOverlay
                                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "disabled", "onChange"]), [
                                    [_vModelCheckbox, roadSyntaxSkeletonOnly]
                                  ]),
                                  _createTextVNode(" 楠ㄦ灦浼樺厛 ")
                                ]))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("span", { class: "count-badge" }, "褰撳墠鎸囨爣 " + _toDisplayString(roadSyntaxLabelByMetric(roadSyntaxMetric)), 1 /* TEXT */),
                            _createElementVNode("span", { class: "count-badge" }, "鍊?" + _toDisplayString(formatRoadSyntaxMetricValue(roadSyntaxMetric)), 1 /* TEXT */),
                            (roadSyntaxMetric === 'intelligibility')
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 5,
                                  class: "count-badge"
                                }, " R虏 " + _toDisplayString(roadSyntaxRegressionView().r2), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true)
                          ]),
                          (roadSyntaxLegendModel && roadSyntaxLegendModel.items && roadSyntaxLegendModel.items.length)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                style: {"margin-top":"10px","border":"1px solid #eef1f4","border-radius":"8px","padding":"8px 10px","background":"#fafbfc"}
                              }, [
                                _createElementVNode("div", { style: {"font-size":"12px","color":"#374151","font-weight":"600","margin-bottom":"6px"} }, _toDisplayString(roadSyntaxLegendModel.title), 1 /* TEXT */),
                                _createElementVNode("div", { style: {"display":"grid","grid-template-columns":"1fr 1fr","gap":"6px 10px"} }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roadSyntaxLegendModel.items, (item, idx) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      key: `road-syntax-legend-${idx}`,
                                      style: {"display":"flex","align-items":"center","gap":"6px","font-size":"11px","color":"#4b5563"}
                                    }, [
                                      _createElementVNode("span", {
                                        style: _normalizeStyle({display:'inline-block', width:'12px', height:'12px', borderRadius:'2px', background:item.color, border:'1px solid #d1d5db'})
                                      }, null, 4 /* STYLE */),
                                      _createElementVNode("span", null, _toDisplayString(item.label), 1 /* TEXT */)
                                    ]))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ])
                              ]))
                            : _createCommentVNode("v-if", true),
                          (roadSyntaxMainTab === 'intelligibility')
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                id: "roadSyntaxScatterChart",
                                style: {"height":"220px","margin-top":"10px"}
                              }))
                            : _createCommentVNode("v-if", true)
                        ])),
                    roadSyntaxSwitchStatsText
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "status-text",
                          style: {"margin-top":"10px"}
                        }, _toDisplayString(roadSyntaxSwitchStatsText), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true),
                    roadSyntaxStatus
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 3,
                          class: "status-text",
                          style: {"margin-top":"10px","display":"flex","align-items":"center","gap":"8px","justify-content":"flex-start"}
                        }, [
                          _createElementVNode("span", null, _toDisplayString(roadSyntaxStatus), 1 /* TEXT */),
                          (isComputingRoadSyntax && Number(roadSyntaxProgressElapsedSec || 0) > 0)
                            ? (_openBlock(), _createElementBlock("span", {
                                key: 0,
                                class: "count-badge"
                              }, _toDisplayString(`璁℃椂 ${Math.floor(Number(roadSyntaxProgressElapsedSec || 0))}s`), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                          (isComputingRoadSyntax && Number(roadSyntaxProgressStep || 0) > 0 && Number(roadSyntaxProgressTotal || 0) > 0)
                            ? (_openBlock(), _createElementBlock("span", {
                                key: 1,
                                class: "count-badge"
                              }, _toDisplayString(`杩涘害 ${roadSyntaxProgressStep}/${roadSyntaxProgressTotal}`), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                        ]))
                      : _createCommentVNode("v-if", true)
                  ], 512 /* NEED_PATCH */), [
                    [_vShow, activeStep3Panel === 'syntax']
                  ])
                ], 512 /* NEED_PATCH */), [
                  [_vShow, !isStep3SidebarCollapsed]
                ])
              ], 2 /* CLASS */)
            ], 512 /* NEED_PATCH */), [
              [_vShow, step === 2]
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, sidebarView === 'wizard']
          ]),
          _createCommentVNode(" End Wizard View Wrapper ")
        ]),
        _createCommentVNode(" End of sidebar-content "),
        _createCommentVNode(" Fixed History Footer "),
        _createCommentVNode(" Sidebar Footer (Only in Wizard Mode) "),
        (sidebarView === 'wizard' && !(Number(step) === 2 && isStep3SidebarCollapsed))
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "sidebar-footer",
              style: {"padding":"20px","border-top":"1px solid #f0f0f0","background":"#fff","display":"flex","flex-direction":"column","gap":"10px"}
            }, [
              _createElementVNode("button", {
                class: "btn-outline",
                style: {"margin-top":"0","border":"1px solid #eee","display":"flex","justify-content":"center","align-items":"center"},
                onClick: $event => (openHistoryView())
              }, [
                _createElementVNode("img", {
                  src: "/static/images/history.svg",
                  class: "icon-svg-small",
                  style: {"margin-right":"8px"}
                }),
                _createTextVNode(" 鏌ョ湅鍘嗗彶璁板綍 (" + _toDisplayString(historyList.length) + ") ", 1 /* TEXT */)
              ], 8 /* PROPS */, ["onClick"])
            ]))
          : _createCommentVNode("v-if", true)
      ], 2 /* CLASS */),
      _createCommentVNode(" Middle: Main Workspace "),
      _createElementVNode("main", {
        class: _normalizeClass(["main-content", { 'main-content-agent-mode': isAgentWorkspaceActive() }])
      }, [
        _withDirectives(_createElementVNode("div", { class: "agent-main-stage" }, [
          _createElementVNode("div", { class: "agent-app-main" }, [
            (agentWorkspaceView === 'tools')
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "agent-tools-workspace"
                }, [
                  _createElementVNode("div", { class: "agent-tools-header" }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("div", { class: "agent-tools-eyebrow" }, "Agent Tool Registry"),
                      _createElementVNode("h2", { class: "agent-tools-title" }, "工具"),
                      _createElementVNode("p", { class: "agent-tools-subtitle" }, "这里展示当前后端 Agent tool registry 中可用的只读元数据，不在工具库内直接执行工具。")
                    ]),
                    _createElementVNode("button", {
                      type: "button",
                      class: "agent-tools-back-btn",
                      onClick: backToAgentChat
                    }, "返回聊天", 8 /* PROPS */, ["onClick"])
                  ]),
                  (agentToolsLoading && !agentTools.length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "agent-tools-state"
                      }, " 正在加载工具库... "))
                    : agentToolsError
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "agent-tools-state is-error"
                        }, [
                          _createElementVNode("div", null, _toDisplayString(agentToolsError), 1 /* TEXT */),
                          _createElementVNode("button", {
                            type: "button",
                            class: "agent-tools-retry-btn",
                            onClick: $event => (loadAgentTools(true))
                          }, "重试", 8 /* PROPS */, ["onClick"])
                        ]))
                      : (!agentTools.length)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "agent-tools-state"
                          }, " 暂无可展示工具 "))
                        : (_openBlock(), _createElementBlock("div", {
                            key: 3,
                            class: "agent-tools-groups"
                          }, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getGroupedAgentTools(), (group) => {
                              return (_openBlock(), _createElementBlock("section", {
                                key: group.key,
                                class: "agent-tools-group"
                              }, [
                                _createElementVNode("div", { class: "agent-tools-group-head" }, [
                                  _createElementVNode("div", null, [
                                    _createElementVNode("div", { class: "agent-tools-group-title" }, _toDisplayString(group.label), 1 /* TEXT */),
                                    _createElementVNode("div", { class: "agent-tools-group-desc" }, _toDisplayString(group.description), 1 /* TEXT */)
                                  ])
                                ]),
                                _createElementVNode("div", { class: "agent-tools-subgroups" }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(group.subgroups, (subgroup) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      key: `${group.key}-${subgroup.key}`,
                                      class: "agent-tools-subgroup"
                                    }, [
                                      _createElementVNode("div", { class: "agent-tools-subgroup-title" }, _toDisplayString(subgroup.label), 1 /* TEXT */),
                                      _createElementVNode("div", { class: "agent-tools-list" }, [
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(subgroup.tools, (tool) => {
                                          return (_openBlock(), _createElementBlock("article", {
                                            key: tool.name,
                                            class: "agent-tool-row"
                                          }, [
                                            _createElementVNode("div", { class: "agent-tool-row-main" }, [
                                              _createElementVNode("div", { class: "agent-tool-row-head" }, [
                                                _createElementVNode("div", { class: "agent-tool-name" }, _toDisplayString(tool.name), 1 /* TEXT */),
                                                _createElementVNode("div", { class: "agent-tool-badges" }, [
                                                  (tool.uiTier === 'scenario')
                                                    ? (_openBlock(), _createElementBlock("span", {
                                                        key: 0,
                                                        class: "agent-tool-badge is-primary"
                                                      }, "Planner 优先"))
                                                    : _createCommentVNode("v-if", true),
                                                  _createElementVNode("span", { class: "agent-tool-badge" }, _toDisplayString(getAgentToolLabel(tool.capabilityType)), 1 /* TEXT */),
                                                  _createElementVNode("span", {
                                                    class: _normalizeClass(["agent-tool-readonly", { 'is-write': !tool.readonly }])
                                                  }, _toDisplayString(tool.readonly ? '只读' : '会写入'), 3 /* TEXT, CLASS */)
                                                ])
                                              ]),
                                              _createElementVNode("div", { class: "agent-tool-description" }, _toDisplayString(tool.description || '暂无说明'), 1 /* TEXT */),
                                              _createElementVNode("div", { class: "agent-tool-meta is-compact" }, [
                                                _createElementVNode("span", null, _toDisplayString(getAgentToolLabel(tool.uiTier)), 1 /* TEXT */),
                                                _createElementVNode("span", null, _toDisplayString(getAgentToolLabel(tool.dataDomain || tool.category)), 1 /* TEXT */),
                                                _createElementVNode("span", null, "风险 " + _toDisplayString(getAgentToolLabel(tool.riskLevel)), 1 /* TEXT */)
                                              ])
                                            ]),
                                            _createElementVNode("button", {
                                              type: "button",
                                              class: "agent-tool-detail-btn",
                                              title: "查看详情",
                                              "aria-label": "查看工具详情",
                                              onClick: $event => (openAgentToolDetail(tool, $event))
                                            }, " i ", 8 /* PROPS */, ["onClick"])
                                          ]))
                                        }), 128 /* KEYED_FRAGMENT */))
                                      ])
                                    ]))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ])
                              ]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ])),
                  (agentToolDetailDialogOpen && getAgentToolDetail())
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 4,
                        class: "agent-tool-detail-mask",
                        onClick: _withModifiers(closeAgentToolDetail, ["self"])
                      }, [
                        _createElementVNode("section", {
                          class: "agent-tool-detail-dialog",
                          role: "dialog",
                          "aria-modal": "true",
                          "aria-labelledby": "agent-tool-detail-title"
                        }, [
                          _createElementVNode("div", { class: "agent-tool-detail-head" }, [
                            _createElementVNode("div", null, [
                              _createElementVNode("div", { class: "agent-tools-eyebrow" }, "Tool Detail"),
                              _createElementVNode("h3", {
                                id: "agent-tool-detail-title",
                                class: "agent-tool-detail-title"
                              }, _toDisplayString(getAgentToolDetail().name), 1 /* TEXT */),
                              _createElementVNode("p", { class: "agent-tool-detail-subtitle" }, _toDisplayString(getAgentToolDetail().description || '暂无说明'), 1 /* TEXT */)
                            ]),
                            _createElementVNode("button", {
                              type: "button",
                              class: "agent-tool-detail-close",
                              "aria-label": "关闭工具详情",
                              onClick: closeAgentToolDetail
                            }, "×", 8 /* PROPS */, ["onClick"])
                          ]),
                          _createElementVNode("div", { class: "agent-tool-badges agent-tool-detail-badges" }, [
                            (getAgentToolDetail().uiTier === 'scenario')
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 0,
                                  class: "agent-tool-badge is-primary"
                                }, "Planner 优先"))
                              : _createCommentVNode("v-if", true),
                            (getAgentToolDetail().defaultPolicyKey)
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 1,
                                  class: "agent-tool-badge"
                                }, _toDisplayString(getAgentToolDetail().defaultPolicyKey), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("span", {
                              class: _normalizeClass(["agent-tool-readonly", { 'is-write': !getAgentToolDetail().readonly }])
                            }, _toDisplayString(getAgentToolDetail().readonly ? '只读' : '会写入'), 3 /* TEXT, CLASS */)
                          ]),
                          _createElementVNode("div", { class: "agent-tool-meta" }, [
                            _createElementVNode("span", null, _toDisplayString(getAgentToolLabel(getAgentToolDetail().uiTier)), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(getAgentToolLabel(getAgentToolDetail().capabilityType)), 1 /* TEXT */),
                            _createElementVNode("span", null, "类别 " + _toDisplayString(getAgentToolLabel(getAgentToolDetail().category)), 1 /* TEXT */),
                            _createElementVNode("span", null, "成本 " + _toDisplayString(getAgentToolLabel(getAgentToolDetail().costLevel)), 1 /* TEXT */),
                            _createElementVNode("span", null, "风险 " + _toDisplayString(getAgentToolLabel(getAgentToolDetail().riskLevel)), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "agent-tool-docs agent-tool-detail-docs" }, [
                            _createElementVNode("div", { class: "agent-tool-doc-row" }, [
                              _createElementVNode("div", { class: "agent-tool-artifact-title" }, "适用场景"),
                              (getAgentToolDetail().applicableScenarios.length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "agent-tool-tags"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentToolDetail().applicableScenarios, (item) => {
                                      return (_openBlock(), _createElementBlock("span", { key: `${getAgentToolDetail().name}-scene-${item}` }, _toDisplayString(item), 1 /* TEXT */))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "agent-tool-empty"
                                  }, "无"))
                            ]),
                            _createElementVNode("div", { class: "agent-tool-doc-row" }, [
                              _createElementVNode("div", { class: "agent-tool-artifact-title" }, "输入参数"),
                              (getAgentToolSchemaFields(getAgentToolDetail().inputSchema).length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "agent-tool-tags"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentToolSchemaFields(getAgentToolDetail().inputSchema), (item) => {
                                      return (_openBlock(), _createElementBlock("span", { key: `${getAgentToolDetail().name}-input-${item}` }, _toDisplayString(item), 1 /* TEXT */))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "agent-tool-empty"
                                  }, "无参数"))
                            ]),
                            _createElementVNode("div", { class: "agent-tool-doc-row" }, [
                              _createElementVNode("div", { class: "agent-tool-artifact-title" }, "输出结果"),
                              (getAgentToolDetail().produces.length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "agent-tool-tags"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentToolDetail().produces, (item) => {
                                      return (_openBlock(), _createElementBlock("span", { key: `${getAgentToolDetail().name}-produces-${item}` }, _toDisplayString(item), 1 /* TEXT */))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "agent-tool-empty"
                                  }, "无"))
                            ]),
                            _createElementVNode("div", { class: "agent-tool-doc-row" }, [
                              _createElementVNode("div", { class: "agent-tool-artifact-title" }, "证据链字段"),
                              (getAgentToolDetail().evidenceContract.length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "agent-tool-tags"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentToolDetail().evidenceContract, (item) => {
                                      return (_openBlock(), _createElementBlock("span", { key: `${getAgentToolDetail().name}-evidence-${item}` }, _toDisplayString(item), 1 /* TEXT */))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "agent-tool-empty"
                                  }, "无"))
                            ]),
                            _createElementVNode("div", { class: "agent-tool-doc-row" }, [
                              _createElementVNode("div", { class: "agent-tool-artifact-title" }, "注意事项"),
                              (getAgentToolDetail().cautions.length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "agent-tool-cautions"
                                  }, _toDisplayString(getAgentToolDetail().cautions.join('；')), 1 /* TEXT */))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 1,
                                    class: "agent-tool-empty"
                                  }, "无"))
                            ])
                          ])
                        ])
                      ], 8 /* PROPS */, ["onClick"]))
                    : _createCommentVNode("v-if", true)
                ]))
              : (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: _normalizeClass(["agent-app-center", {
                            'is-empty': !agentHasConversationContent() && !agentLoading && !agentSessionHydrating,
                            'has-thread': agentHasConversationContent() || agentLoading || agentSessionHydrating
                        }])
                }, [
                  (!agentHasConversationContent() && !agentLoading && !agentSessionHydrating)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "agent-hero"
                      }, [
                        _createElementVNode("div", { class: "agent-hero-title" }, "我们先从哪里开始呢？"),
                        _createElementVNode("div", { class: "agent-hero-subtitle" }, "先说问题，Agent 会调用已有工具和分析能力直接处理。")
                      ]))
                    : _createCommentVNode("v-if", true),
                  (agentHasConversationContent() || agentLoading || agentSessionHydrating)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "agent-thread-shell"
                      }, [
                        _createElementVNode("div", {
                          ref: "agentChatBody",
                          class: "agent-chat-body agent-chat-body-main",
                          onScrollPassive: onAgentChatBodyScroll,
                          onWheelPassive: onAgentChatBodyWheel,
                          onTouchmovePassive: onAgentChatBodyTouchMove
                        }, [
                          agentSessionHydrating
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "agent-session-skeleton",
                                "aria-hidden": "true"
                              }, [
                                _createElementVNode("div", { class: "agent-session-skeleton-row is-user" }, [
                                  _createElementVNode("div", { class: "agent-session-skeleton-bubble is-user" })
                                ]),
                                _createElementVNode("div", { class: "agent-session-skeleton-row is-assistant" }, [
                                  _createElementVNode("div", { class: "agent-session-skeleton-bubble is-assistant is-wide" })
                                ]),
                                _createElementVNode("div", { class: "agent-session-skeleton-row is-assistant" }, [
                                  _createElementVNode("div", { class: "agent-session-skeleton-card" }, [
                                    _createElementVNode("div", { class: "agent-session-skeleton-line short" }),
                                    _createElementVNode("div", { class: "agent-session-skeleton-line" }),
                                    _createElementVNode("div", { class: "agent-session-skeleton-line" }),
                                    _createElementVNode("div", { class: "agent-session-skeleton-line medium" })
                                  ])
                                ])
                              ]))
                            : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentMessagesBeforeThinking(), (message, index) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: `agent-message-main-before-${index}`,
                                    class: _normalizeClass(["agent-message-row", `is-${message.role}`])
                                  }, [
                                    _createElementVNode("div", {
                                      class: _normalizeClass(["agent-message-bubble", `is-${message.role}`])
                                    }, _toDisplayString(message.content), 3 /* TEXT, CLASS */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */)),
                                (agentShouldRenderThinkingBlock())
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 0,
                                      class: "agent-message-row is-assistant"
                                    }, [
                                      _createElementVNode("div", {
                                        class: _normalizeClass(["agent-message-bubble is-assistant agent-thinking-bubble", { 'is-debug-open': agentThinkingExpanded }])
                                      }, [
                                        _createElementVNode("div", { class: "agent-thinking-head" }, [
                                          _createElementVNode("div", { class: "agent-thinking-status" }, [
                                            _createElementVNode("span", {
                                              class: _normalizeClass(["agent-thinking-dot", { 'is-running': agentLoading }])
                                            }, null, 2 /* CLASS */),
                                            _createElementVNode("span", null, _toDisplayString(getAgentThinkingStatusLabel()), 1 /* TEXT */),
                                            (getAgentThinkingElapsedLabel())
                                              ? (_openBlock(), _createElementBlock("span", {
                                                  key: 0,
                                                  class: "agent-thinking-elapsed"
                                                }, _toDisplayString(getAgentThinkingElapsedLabel()), 1 /* TEXT */))
                                              : _createCommentVNode("v-if", true)
                                          ]),
                                          (agentThinkingTimeline.length || agentReasoningBlocks.length || agentExecutionTrace.length || getAgentPlanChecklist().visible || agentResearchNotes.length)
                                            ? (_openBlock(), _createElementBlock("button", {
                                                key: 0,
                                                type: "button",
                                                class: "agent-thinking-toggle",
                                                onClick: toggleAgentThinkingExpanded
                                              }, _toDisplayString(agentThinkingExpanded ? '收起过程' : '查看过程'), 9 /* TEXT, PROPS */, ["onClick"]))
                                            : _createCommentVNode("v-if", true)
                                        ]),
                                        ((agentThinkingExpanded || agentLoading) && getAgentVisibleReasoningBlocks().length)
                                          ? (_openBlock(), _createElementBlock("div", {
                                              key: 0,
                                              class: "agent-reasoning-panel"
                                            }, [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentVisibleReasoningBlocks(), (block) => {
                                                return (_openBlock(), _createElementBlock("div", {
                                                  key: `agent-reasoning-${block.id}`,
                                                  class: _normalizeClass(["agent-reasoning-block", `is-${block.state || 'active'}`])
                                                }, [
                                                  _createElementVNode("div", { class: "agent-reasoning-title" }, _toDisplayString(block.title || '模型思考'), 1 /* TEXT */),
                                                  (block.content)
                                                    ? (_openBlock(), _createElementBlock("pre", {
                                                        key: 0,
                                                        class: "agent-reasoning-content",
                                                        "data-agent-scroll-inner": "",
                                                        onWheelPassive: _withModifiers(onAgentInnerScrollIntent, ["stop"]),
                                                        onTouchmovePassive: _withModifiers(onAgentInnerScrollIntent, ["stop"]),
                                                        onScrollPassive: onAgentInnerScrollIntent
                                                      }, _toDisplayString(block.content), 41 /* TEXT, PROPS, NEED_HYDRATION */, ["onWheelPassive", "onTouchmovePassive", "onScrollPassive"]))
                                                    : (_openBlock(), _createElementBlock("div", {
                                                        key: 1,
                                                        class: "agent-reasoning-placeholder"
                                                      }, "等待模型输出思考过程..."))
                                                ], 2 /* CLASS */))
                                              }), 128 /* KEYED_FRAGMENT */))
                                            ]))
                                          : _createCommentVNode("v-if", true),
                                        (agentThinkingExpanded || agentLoading)
                                          ? (_openBlock(), _createElementBlock("div", {
                                              key: 1,
                                              class: "agent-thinking-steps",
                                              "data-agent-scroll-inner": "",
                                              onWheelPassive: _withModifiers(onAgentInnerScrollIntent, ["stop"]),
                                              onTouchmovePassive: _withModifiers(onAgentInnerScrollIntent, ["stop"]),
                                              onScrollPassive: onAgentInnerScrollIntent
                                            }, [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentProcessRoleGroups(), (roleGroup) => {
                                                return (_openBlock(), _createElementBlock("div", {
                                                  key: `agent-process-role-${roleGroup.key}`,
                                                  class: _normalizeClass(["agent-process-role-panel", `is-${roleGroup.state}`])
                                                }, [
                                                  _createElementVNode("div", { class: "agent-process-role-head" }, [
                                                    _createElementVNode("div", null, [
                                                      _createElementVNode("div", { class: "agent-process-role-title" }, _toDisplayString(roleGroup.title), 1 /* TEXT */),
                                                      _createElementVNode("div", { class: "agent-process-role-summary" }, _toDisplayString(roleGroup.summary), 1 /* TEXT */)
                                                    ]),
                                                    (roleGroup.countLabel)
                                                      ? (_openBlock(), _createElementBlock("div", {
                                                          key: 0,
                                                          class: "agent-process-role-count"
                                                        }, _toDisplayString(roleGroup.countLabel), 1 /* TEXT */))
                                                      : _createCommentVNode("v-if", true)
                                                  ]),
                                                  _createElementVNode("div", { class: "agent-process-role-steps" }, [
                                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roleGroup.steps, (stepItem) => {
                                                      return (_openBlock(), _createElementBlock("div", {
                                                        key: `agent-visible-process-${stepItem.id}`,
                                                        class: _normalizeClass(["agent-thinking-current", `is-${stepItem.state}`])
                                                      }, [
                                                        _createElementVNode("div", { class: "agent-thinking-item-title" }, _toDisplayString(stepItem.title), 1 /* TEXT */),
                                                        (stepItem.detail)
                                                          ? (_openBlock(), _createElementBlock("div", {
                                                              key: 0,
                                                              class: "agent-thinking-item-detail"
                                                            }, _toDisplayString(stepItem.detail), 1 /* TEXT */))
                                                          : _createCommentVNode("v-if", true),
                                                        (stepItem.items && stepItem.items.length)
                                                          ? (_openBlock(), _createElementBlock("div", {
                                                              key: 1,
                                                              class: "agent-thinking-item-list"
                                                            }, [
                                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(stepItem.items.slice(0, 3), (subItem, subIndex) => {
                                                                return (_openBlock(), _createElementBlock("div", {
                                                                  key: `${stepItem.id}-current-item-${subIndex}`,
                                                                  class: "agent-thinking-item-meta"
                                                                }, _toDisplayString(subItem), 1 /* TEXT */))
                                                              }), 128 /* KEYED_FRAGMENT */))
                                                            ]))
                                                          : _createCommentVNode("v-if", true)
                                                      ], 2 /* CLASS */))
                                                    }), 128 /* KEYED_FRAGMENT */)),
                                                    (roleGroup.planChecklist && roleGroup.planChecklist.visible)
                                                      ? (_openBlock(), _createElementBlock("div", {
                                                          key: 0,
                                                          class: "agent-process-role-detail-block is-plan"
                                                        }, [
                                                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roleGroup.planChecklist.groups, (group) => {
                                                            return (_openBlock(), _createElementBlock("div", {
                                                              key: `agent-role-plan-group-${group.key}`,
                                                              class: "agent-plan-group"
                                                            }, [
                                                              _createElementVNode("div", { class: "agent-plan-group-head" }, [
                                                                _createElementVNode("div", { class: "agent-plan-group-title" }, _toDisplayString(group.title), 1 /* TEXT */),
                                                                _createElementVNode("div", { class: "agent-plan-group-desc" }, _toDisplayString(group.description), 1 /* TEXT */)
                                                              ]),
                                                              _createElementVNode("div", { class: "agent-plan-items" }, [
                                                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(group.items, (item, index) => {
                                                                  return (_openBlock(), _createElementBlock("div", {
                                                                    key: `agent-role-plan-item-${group.key}-${index}`,
                                                                    class: _normalizeClass(["agent-plan-item", `is-${item.status}`])
                                                                  }, [
                                                                    _createElementVNode("div", {
                                                                      class: "agent-plan-item-status",
                                                                      title: getAgentPlanStatusLabel(item.status)
                                                                    }, _toDisplayString(getAgentPlanStatusSymbol(item.status)), 9 /* TEXT, PROPS */, ["title"]),
                                                                    _createElementVNode("div", { class: "agent-plan-item-main" }, [
                                                                      _createElementVNode("div", { class: "agent-plan-item-title-row" }, [
                                                                        _createElementVNode("div", { class: "agent-plan-item-title" }, _toDisplayString(item.title), 1 /* TEXT */),
                                                                        (item.optional)
                                                                          ? (_openBlock(), _createElementBlock("div", {
                                                                              key: 0,
                                                                              class: "agent-plan-item-optional"
                                                                            }, "可选"))
                                                                          : _createCommentVNode("v-if", true)
                                                                      ]),
                                                                      (item.detail)
                                                                        ? (_openBlock(), _createElementBlock("div", {
                                                                            key: 0,
                                                                            class: "agent-plan-item-detail"
                                                                          }, _toDisplayString(item.detail), 1 /* TEXT */))
                                                                        : _createCommentVNode("v-if", true)
                                                                    ])
                                                                  ], 2 /* CLASS */))
                                                                }), 128 /* KEYED_FRAGMENT */))
                                                              ])
                                                            ]))
                                                          }), 128 /* KEYED_FRAGMENT */))
                                                        ]))
                                                      : _createCommentVNode("v-if", true),
                                                    (roleGroup.toolCallItems && roleGroup.toolCallItems.length)
                                                      ? (_openBlock(), _createElementBlock("div", {
                                                          key: 1,
                                                          class: "agent-process-role-detail-block is-trace"
                                                        }, [
                                                          _createElementVNode("div", { class: "agent-trace-list" }, [
                                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roleGroup.toolCallItems, (item) => {
                                                              return (_openBlock(), _createElementBlock("div", {
                                                                key: `agent-role-trace-item-${item.id}`,
                                                                class: "agent-trace-item"
                                                              }, [
                                                                _createElementVNode("div", { class: "agent-trace-main" }, [
                                                                  _createElementVNode("div", { class: "agent-process-entry-title" }, _toDisplayString(item.toolName), 1 /* TEXT */),
                                                                  _createElementVNode("span", {
                                                                    class: _normalizeClass(["agent-trace-status", `is-${item.statusTone}`])
                                                                  }, _toDisplayString(getAgentToolCallStatusLabel(item.status)), 3 /* TEXT, CLASS */)
                                                                ]),
                                                                (item.message || item.reason)
                                                                  ? (_openBlock(), _createElementBlock("div", {
                                                                      key: 0,
                                                                      class: "agent-process-entry-detail"
                                                                    }, _toDisplayString(item.message || item.reason), 1 /* TEXT */))
                                                                  : _createCommentVNode("v-if", true),
                                                                _createElementVNode("div", { class: "agent-trace-meta" }, [
                                                                  (item.argumentsSummary)
                                                                    ? (_openBlock(), _createElementBlock("span", { key: 0 }, "参数：" + _toDisplayString(item.argumentsSummary), 1 /* TEXT */))
                                                                    : _createCommentVNode("v-if", true),
                                                                  (item.resultSummary)
                                                                    ? (_openBlock(), _createElementBlock("span", { key: 1 }, "结果：" + _toDisplayString(item.resultSummary), 1 /* TEXT */))
                                                                    : _createCommentVNode("v-if", true),
                                                                  (item.evidenceCount !== undefined && item.evidenceCount !== null && String(item.evidenceCount) !== '')
                                                                    ? (_openBlock(), _createElementBlock("span", { key: 2 }, "证据：" + _toDisplayString(item.evidenceCount) + " 条", 1 /* TEXT */))
                                                                    : _createCommentVNode("v-if", true),
                                                                  (item.warningCount !== undefined && item.warningCount !== null && Number(item.warningCount) > 0)
                                                                    ? (_openBlock(), _createElementBlock("span", { key: 3 }, "警告：" + _toDisplayString(item.warningCount) + " 条", 1 /* TEXT */))
                                                                    : _createCommentVNode("v-if", true)
                                                                ]),
                                                                (item.producedArtifacts.length)
                                                                  ? (_openBlock(), _createElementBlock("div", {
                                                                      key: 1,
                                                                      class: "agent-process-chip-row"
                                                                    }, [
                                                                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(item.producedArtifacts, (artifact) => {
                                                                        return (_openBlock(), _createElementBlock("span", {
                                                                          key: `${item.id}-${artifact}`,
                                                                          class: "agent-process-chip"
                                                                        }, _toDisplayString(artifact), 1 /* TEXT */))
                                                                      }), 128 /* KEYED_FRAGMENT */))
                                                                    ]))
                                                                  : _createCommentVNode("v-if", true)
                                                              ]))
                                                            }), 128 /* KEYED_FRAGMENT */))
                                                          ])
                                                        ]))
                                                      : _createCommentVNode("v-if", true),
                                                    (roleGroup.taskConfirmation)
                                                      ? (_openBlock(), _createElementBlock("div", {
                                                          key: 2,
                                                          class: "agent-process-role-detail-block is-task-confirmation"
                                                        }, [
                                                          _createElementVNode("div", {
                                                            class: _normalizeClass(["agent-task-confirmation-card", `is-${roleGroup.taskConfirmation.status}`])
                                                          }, [
                                                            _createElementVNode("div", { class: "agent-task-confirmation-head" }, [
                                                              _createElementVNode("div", null, [
                                                                _createElementVNode("div", { class: "agent-task-confirmation-title" }, _toDisplayString(roleGroup.taskConfirmation.title), 1 /* TEXT */),
                                                                _createElementVNode("div", { class: "agent-task-confirmation-desc" }, _toDisplayString(roleGroup.taskConfirmation.description), 1 /* TEXT */)
                                                              ]),
                                                              _createElementVNode("span", {
                                                                class: _normalizeClass(["agent-trace-status", `is-${getAgentTaskConfirmationProcessState(roleGroup.taskConfirmation.status)}`])
                                                              }, _toDisplayString(getAgentTaskConfirmationStatusLabel(roleGroup.taskConfirmation.status)), 3 /* TEXT, CLASS */)
                                                            ]),
                                                            _createElementVNode("div", { class: "agent-task-confirmation-meta" }, [
                                                              _createElementVNode("span", null, "面板：" + _toDisplayString(roleGroup.taskConfirmation.subPanelLabel), 1 /* TEXT */),
                                                              _createElementVNode("span", null, "预计耗时：" + _toDisplayString(roleGroup.taskConfirmation.estimate), 1 /* TEXT */),
                                                              (roleGroup.taskConfirmation.parameterSummary)
                                                                ? (_openBlock(), _createElementBlock("span", { key: 0 }, "参数：" + _toDisplayString(roleGroup.taskConfirmation.parameterSummary), 1 /* TEXT */))
                                                                : _createCommentVNode("v-if", true)
                                                            ]),
                                                            _createElementVNode("div", { class: "agent-task-confirmation-usage" }, _toDisplayString(roleGroup.taskConfirmation.resultUsage), 1 /* TEXT */),
                                                            (roleGroup.taskConfirmation.blockReason)
                                                              ? (_openBlock(), _createElementBlock("div", {
                                                                  key: 0,
                                                                  class: "agent-task-confirmation-warning"
                                                                }, _toDisplayString(roleGroup.taskConfirmation.blockReason), 1 /* TEXT */))
                                                              : _createCommentVNode("v-if", true),
                                                            (roleGroup.taskConfirmation.error)
                                                              ? (_openBlock(), _createElementBlock("div", {
                                                                  key: 1,
                                                                  class: "agent-task-confirmation-warning is-error"
                                                                }, _toDisplayString(roleGroup.taskConfirmation.error), 1 /* TEXT */))
                                                              : _createCommentVNode("v-if", true),
                                                            _createElementVNode("div", { class: "agent-task-confirmation-actions" }, [
                                                              (roleGroup.taskConfirmation.canReuse && roleGroup.taskConfirmation.status === 'reuse_available')
                                                                ? (_openBlock(), _createElementBlock("button", {
                                                                    key: 0,
                                                                    type: "button",
                                                                    class: "agent-task-confirmation-btn is-primary",
                                                                    disabled: agentLoading || agentSessionHydrating,
                                                                    onClick: $event => (onAgentTaskReuseClick(roleGroup.taskConfirmation))
                                                                  }, " 复用已有结果 ", 8 /* PROPS */, ["disabled", "onClick"]))
                                                                : _createCommentVNode("v-if", true),
                                                              _createElementVNode("button", {
                                                                type: "button",
                                                                class: "agent-task-confirmation-btn is-primary",
                                                                disabled: agentLoading || agentSessionHydrating || !roleGroup.taskConfirmation.canStart || ['blocked','running','executing','completed','cancelled'].includes(roleGroup.taskConfirmation.status),
                                                                onClick: $event => (onAgentTaskStartClick(roleGroup.taskConfirmation))
                                                              }, _toDisplayString(roleGroup.taskConfirmation.status === 'reuse_available' ? '重新计算' : '开始计算'), 9 /* TEXT, PROPS */, ["disabled", "onClick"]),
                                                              _createElementVNode("button", {
                                                                type: "button",
                                                                class: "agent-task-confirmation-btn",
                                                                onClick: $event => (onAgentTaskAdjustClick(roleGroup.taskConfirmation))
                                                              }, " 调整参数 ", 8 /* PROPS */, ["onClick"]),
                                                              (!['completed','cancelled','executing'].includes(roleGroup.taskConfirmation.status))
                                                                ? (_openBlock(), _createElementBlock("button", {
                                                                    key: 1,
                                                                    type: "button",
                                                                    class: "agent-task-confirmation-btn",
                                                                    onClick: $event => (onAgentTaskCancelClick(roleGroup.taskConfirmation))
                                                                  }, " 取消 ", 8 /* PROPS */, ["onClick"]))
                                                                : _createCommentVNode("v-if", true)
                                                            ])
                                                          ], 2 /* CLASS */)
                                                        ]))
                                                      : _createCommentVNode("v-if", true)
                                                  ])
                                                ], 2 /* CLASS */))
                                              }), 128 /* KEYED_FRAGMENT */))
                                            ], 40 /* PROPS, NEED_HYDRATION */, ["onWheelPassive", "onTouchmovePassive", "onScrollPassive"]))
                                          : _createCommentVNode("v-if", true)
                                      ], 2 /* CLASS */)
                                    ]))
                                  : _createCommentVNode("v-if", true),
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentMessagesAfterThinking(), (message, index) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: `agent-message-main-after-${index}`,
                                    class: _normalizeClass(["agent-message-row", `is-${message.role}`])
                                  }, [
                                    _createElementVNode("div", {
                                      class: _normalizeClass(["agent-message-bubble", `is-${message.role}`])
                                    }, _toDisplayString(message.content), 3 /* TEXT, CLASS */)
                                  ], 2 /* CLASS */))
                                }), 128 /* KEYED_FRAGMENT */)),
                                agentClarificationQuestion
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 1,
                                      class: "agent-message-row is-assistant"
                                    }, [
                                      _createElementVNode("div", { class: "agent-clarification-card" }, [
                                        _createElementVNode("div", { class: "agent-clarification-title" }, _toDisplayString(agentClarificationQuestion), 1 /* TEXT */),
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getAgentClarificationOptions(), (option, index) => {
                                          return (_openBlock(), _createElementBlock("div", {
                                            key: `agent-clarify-option-${index}`,
                                            class: "agent-clarification-row"
                                          }, [
                                            _createElementVNode("div", { class: "agent-clarification-index" }, _toDisplayString(index + 1) + ".", 1 /* TEXT */),
                                            _createElementVNode("button", {
                                              type: "button",
                                              class: "agent-clarification-option",
                                              disabled: agentLoading || agentClarificationSubmitting,
                                              onClick: $event => (onAgentClarificationOptionClick(option))
                                            }, _toDisplayString(option), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                                          ]))
                                        }), 128 /* KEYED_FRAGMENT */)),
                                        _createElementVNode("div", { class: "agent-clarification-row is-input" }, [
                                          _createElementVNode("div", {
                                            class: _normalizeClass(["agent-clarification-index", { 'is-empty': !hasAgentClarificationOptions() }]),
                                            "aria-hidden": !hasAgentClarificationOptions() ? 'true' : 'false'
                                          }, _toDisplayString(getAgentClarificationInputIndexLabel()), 11 /* TEXT, CLASS, PROPS */, ["aria-hidden"]),
                                          _createElementVNode("div", { class: "agent-clarification-input-wrap" }, [
                                            _withDirectives(_createElementVNode("input", {
                                              "onUpdate:modelValue": $event => ((agentClarificationDraft) = $event),
                                              type: "text",
                                              class: "agent-clarification-input",
                                              placeholder: "输入更具体的问题",
                                              disabled: agentLoading || agentClarificationSubmitting || agentSessionHydrating,
                                              onKeydown: _withKeys(_withModifiers($event => (onAgentClarificationDraftSubmit()), ["prevent"]), ["enter"])
                                            }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "disabled", "onKeydown"]), [
                                              [_vModelText, agentClarificationDraft]
                                            ]),
                                            _createElementVNode("button", {
                                              type: "button",
                                              class: "agent-clarification-submit",
                                              disabled: !canSubmitAgentClarificationDraft(),
                                              onClick: $event => (onAgentClarificationDraftSubmit())
                                            }, " 发送 ", 8 /* PROPS */, ["disabled", "onClick"])
                                          ])
                                        ])
                                      ])
                                    ]))
                                  : agentRiskPrompt
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 2,
                                        class: "agent-message-row is-assistant"
                                      }, [
                                        _createElementVNode("div", { class: "agent-message-bubble is-assistant agent-message-bubble-note" }, [
                                          _createElementVNode("div", null, _toDisplayString(agentRiskPrompt), 1 /* TEXT */)
                                        ])
                                      ]))
                                    : agentError
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 3,
                                          class: "agent-message-row is-assistant"
                                        }, [
                                          _createElementVNode("div", { class: "agent-message-bubble is-assistant agent-message-bubble-error" }, _toDisplayString(agentError), 1 /* TEXT */)
                                        ]))
                                      : _createCommentVNode("v-if", true),
                                (hasAgentStructuredOutput())
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 4,
                                      class: "agent-message-row is-assistant"
                                    }, [
                                      _createElementVNode("div", { class: "agent-message-bubble is-assistant agent-card-bubble" }, [
                                        _createElementVNode("div", { class: "agent-decision-layout" }, [
                                          _createElementVNode("div", { class: "agent-card agent-card-decision" }, [
                                            _createElementVNode("div", { class: "agent-card-type" }, "decision"),
                                            _createElementVNode("div", { class: "agent-card-title" }, "核心判断"),
                                            _createElementVNode("div", { class: "agent-card-content" }, _toDisplayString(agentDecision.summary), 1 /* TEXT */),
                                            _createElementVNode("div", { class: "agent-decision-badges" }, [
                                              _createElementVNode("span", { class: "agent-decision-badge" }, _toDisplayString(getAgentDecisionStrengthLabel(agentDecision.strength)), 1 /* TEXT */),
                                              _createElementVNode("span", { class: "agent-decision-badge is-muted" }, _toDisplayString(getAgentDecisionModeLabel(agentDecision.mode)), 1 /* TEXT */),
                                              (agentDecision.canAct)
                                                ? (_openBlock(), _createElementBlock("span", {
                                                    key: 0,
                                                    class: "agent-decision-badge is-positive"
                                                  }, "可直接推进"))
                                                : _createCommentVNode("v-if", true)
                                            ])
                                          ]),
                                          (agentSupport.length)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 0,
                                                class: "agent-card"
                                              }, [
                                                _createElementVNode("div", { class: "agent-card-type" }, "support"),
                                                _createElementVNode("div", { class: "agent-card-title" }, "为什么这么判断"),
                                                _createElementVNode("ul", { class: "agent-card-items" }, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentSupport, (item, index) => {
                                                    return (_openBlock(), _createElementBlock("li", { key: getAgentStructuredItemKey(item, index) }, [
                                                      _createElementVNode("span", { class: "agent-structured-headline" }, _toDisplayString(item.headline || item.metric), 1 /* TEXT */),
                                                      _createElementVNode("span", { class: "agent-structured-detail" }, _toDisplayString(item.interpretation), 1 /* TEXT */),
                                                      _createElementVNode("span", { class: "agent-structured-meta" }, "来源：" + _toDisplayString(item.source || '未标注') + "｜置信度：" + _toDisplayString(item.confidence || 'weak'), 1 /* TEXT */)
                                                    ]))
                                                  }), 128 /* KEYED_FRAGMENT */))
                                                ])
                                              ]))
                                            : _createCommentVNode("v-if", true),
                                          (agentCounterpoints.length || agentBoundary.length)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 1,
                                                class: "agent-card"
                                              }, [
                                                _createElementVNode("div", { class: "agent-card-type" }, "counterpoints"),
                                                _createElementVNode("div", { class: "agent-card-title" }, "还不能判断什么"),
                                                _createElementVNode("ul", { class: "agent-card-items" }, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentCounterpoints, (item, index) => {
                                                    return (_openBlock(), _createElementBlock("li", { key: `agent-counterpoint-${getAgentStructuredItemKey(item, index)}` }, [
                                                      _createElementVNode("span", { class: "agent-structured-headline" }, _toDisplayString(item.title || '约束'), 1 /* TEXT */),
                                                      _createElementVNode("span", { class: "agent-structured-detail" }, _toDisplayString(item.detail), 1 /* TEXT */)
                                                    ]))
                                                  }), 128 /* KEYED_FRAGMENT */)),
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentBoundary, (item, index) => {
                                                    return (_openBlock(), _createElementBlock("li", { key: `agent-boundary-${getAgentStructuredItemKey(item, index)}` }, [
                                                      _createElementVNode("span", { class: "agent-structured-headline" }, _toDisplayString(item.title || '适用边界'), 1 /* TEXT */),
                                                      _createElementVNode("span", { class: "agent-structured-detail" }, _toDisplayString(item.detail), 1 /* TEXT */)
                                                    ]))
                                                  }), 128 /* KEYED_FRAGMENT */))
                                                ])
                                              ]))
                                            : _createCommentVNode("v-if", true),
                                          (agentActions.length)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 2,
                                                class: "agent-card"
                                              }, [
                                                _createElementVNode("div", { class: "agent-card-type" }, "actions"),
                                                _createElementVNode("div", { class: "agent-card-title" }, "下一步怎么做"),
                                                _createElementVNode("ul", { class: "agent-card-items" }, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentActions, (item, index) => {
                                                    return (_openBlock(), _createElementBlock("li", { key: `agent-action-${getAgentStructuredItemKey(item, index)}` }, [
                                                      (hasAgentActionPrompt(item))
                                                        ? (_openBlock(), _createElementBlock("button", {
                                                            key: 0,
                                                            type: "button",
                                                            class: "agent-card-item-btn",
                                                            onClick: $event => (onAgentActionPromptClick(item))
                                                          }, _toDisplayString(item.title || item.detail), 9 /* TEXT, PROPS */, ["onClick"]))
                                                        : (_openBlock(), _createElementBlock("span", {
                                                            key: 1,
                                                            class: "agent-structured-headline"
                                                          }, _toDisplayString(item.title || item.detail), 1 /* TEXT */)),
                                                      (item.detail)
                                                        ? (_openBlock(), _createElementBlock("div", {
                                                            key: 2,
                                                            class: "agent-structured-detail"
                                                          }, _toDisplayString(item.detail), 1 /* TEXT */))
                                                        : _createCommentVNode("v-if", true),
                                                      (item.condition || item.target)
                                                        ? (_openBlock(), _createElementBlock("div", {
                                                            key: 3,
                                                            class: "agent-structured-meta"
                                                          }, [
                                                            (item.condition)
                                                              ? (_openBlock(), _createElementBlock("span", { key: 0 }, "触发条件：" + _toDisplayString(item.condition), 1 /* TEXT */))
                                                              : _createCommentVNode("v-if", true),
                                                            (item.target)
                                                              ? (_openBlock(), _createElementBlock("span", { key: 1 }, "｜目标：" + _toDisplayString(item.target), 1 /* TEXT */))
                                                              : _createCommentVNode("v-if", true)
                                                          ]))
                                                        : _createCommentVNode("v-if", true)
                                                    ]))
                                                  }), 128 /* KEYED_FRAGMENT */))
                                                ])
                                              ]))
                                            : _createCommentVNode("v-if", true)
                                        ])
                                      ])
                                    ]))
                                  : (agentCards.length)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 5,
                                        class: "agent-message-row is-assistant"
                                      }, [
                                        _createElementVNode("div", { class: "agent-message-bubble is-assistant agent-card-bubble" }, [
                                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentCards, (card, index) => {
                                            return (_openBlock(), _createElementBlock("div", {
                                              key: `agent-main-card-${index}`,
                                              class: "agent-card"
                                            }, [
                                              _createElementVNode("div", { class: "agent-card-type" }, _toDisplayString(card.type), 1 /* TEXT */),
                                              _createElementVNode("div", { class: "agent-card-title" }, _toDisplayString(card.title), 1 /* TEXT */),
                                              _createElementVNode("div", { class: "agent-card-content" }, _toDisplayString(card.content), 1 /* TEXT */),
                                              (card.items && card.items.length)
                                                ? (_openBlock(), _createElementBlock("ul", {
                                                    key: 0,
                                                    class: "agent-card-items"
                                                  }, [
                                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(card.items, (item, itemIndex) => {
                                                      return (_openBlock(), _createElementBlock("li", { key: getAgentCardItemKey(item, itemIndex) }, [
                                                        (isAgentCardActionItem(item))
                                                          ? (_openBlock(), _createElementBlock("button", {
                                                              key: 0,
                                                              type: "button",
                                                              class: "agent-card-item-btn",
                                                              onClick: $event => (onAgentCardItemClick(item))
                                                            }, _toDisplayString(getAgentCardItemText(item)), 9 /* TEXT, PROPS */, ["onClick"]))
                                                          : (_openBlock(), _createElementBlock("span", { key: 1 }, _toDisplayString(getAgentCardItemText(item)), 1 /* TEXT */))
                                                      ]))
                                                    }), 128 /* KEYED_FRAGMENT */))
                                                  ]))
                                                : _createCommentVNode("v-if", true)
                                            ]))
                                          }), 128 /* KEYED_FRAGMENT */))
                                        ])
                                      ]))
                                    : _createCommentVNode("v-if", true),
                                (agentResearchNotes.length || agentNextSuggestions.length || agentCitations.length)
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 6,
                                      class: "agent-meta-inline"
                                    }, [
                                      (agentResearchNotes.length)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 0,
                                            class: "agent-meta-group"
                                          }, [
                                            _createElementVNode("div", { class: "agent-meta-title" }, "研究笔记"),
                                            _createElementVNode("ul", { class: "agent-meta-list" }, [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentResearchNotes, (item, index) => {
                                                return (_openBlock(), _createElementBlock("li", { key: `agent-main-note-${index}` }, _toDisplayString(item), 1 /* TEXT */))
                                              }), 128 /* KEYED_FRAGMENT */))
                                            ])
                                          ]))
                                        : _createCommentVNode("v-if", true),
                                      (agentNextSuggestions.length)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 1,
                                            class: "agent-meta-group"
                                          }, [
                                            _createElementVNode("div", { class: "agent-meta-title" }, "下一步建议"),
                                            _createElementVNode("ul", { class: "agent-meta-list" }, [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentNextSuggestions, (item, index) => {
                                                return (_openBlock(), _createElementBlock("li", { key: `agent-main-next-${index}` }, _toDisplayString(item), 1 /* TEXT */))
                                              }), 128 /* KEYED_FRAGMENT */))
                                            ])
                                          ]))
                                        : _createCommentVNode("v-if", true),
                                      (agentCitations.length)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 2,
                                            class: "agent-meta-group"
                                          }, [
                                            _createElementVNode("div", { class: "agent-meta-title" }, "引用"),
                                            _createElementVNode("ul", { class: "agent-meta-list" }, [
                                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(agentCitations, (item, index) => {
                                                return (_openBlock(), _createElementBlock("li", { key: `agent-main-citation-${index}` }, _toDisplayString(item), 1 /* TEXT */))
                                              }), 128 /* KEYED_FRAGMENT */))
                                            ])
                                          ]))
                                        : _createCommentVNode("v-if", true)
                                    ]))
                                  : _createCommentVNode("v-if", true)
                              ], 64 /* STABLE_FRAGMENT */))
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onScrollPassive", "onWheelPassive", "onTouchmovePassive"])
                      ]))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "agent-app-composer-wrap" }, [
                    _createElementVNode("div", { class: "agent-chat-shortcuts" }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "agent-shortcut-chip",
                        onClick: $event => (queueAgentPrompt('总结这个区域的商业特征'))
                      }, "总结区域", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "agent-shortcut-chip",
                        onClick: $event => (queueAgentPrompt('哪里适合补充餐饮'))
                      }, "补充餐饮", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "agent-shortcut-chip",
                        onClick: $event => (queueAgentPrompt('为什么这里路网差'))
                      }, "路网原因", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "agent-shortcut-chip",
                        onClick: $event => (queueAgentPrompt('下一步做什么分析'))
                      }, "下一步建议", 8 /* PROPS */, ["onClick"])
                    ]),
                    _createElementVNode("div", { class: "agent-composer-card" }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "agent-composer-plus",
                        onClick: startNewAgentChat,
                        title: "新聊天"
                      }, "+", 8 /* PROPS */, ["onClick"]),
                      _withDirectives(_createElementVNode("textarea", {
                        "onUpdate:modelValue": $event => ((agentInput) = $event),
                        class: "agent-composer-input",
                        placeholder: "有问题，尽管问",
                        onKeydown: _withKeys(_withModifiers($event => (submitAgentTurn()), ["exact","prevent"]), ["enter"])
                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onKeydown"]), [
                        [_vModelText, agentInput]
                      ]),
                      _createElementVNode("div", { class: "agent-composer-actions" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: _normalizeClass(["agent-composer-send", { 'is-loading': agentLoading }]),
                          disabled: agentSessionHydrating || (!agentLoading && !agentCanSubmit()),
                          title: agentLoading ? '暂停执行' : '发送',
                          onClick: $event => (agentLoading ? cancelAgentTurn() : submitAgentTurn())
                        }, [
                          (!agentLoading)
                            ? (_openBlock(), _createElementBlock("span", { key: 0 }, "发送"))
                            : (_openBlock(), _createElementBlock("span", {
                                key: 1,
                                class: "agent-composer-send-loading",
                                "aria-hidden": "true"
                              }, [
                                _createElementVNode("span", { class: "agent-composer-send-stop" })
                              ]))
                        ], 10 /* CLASS, PROPS */, ["disabled", "title", "onClick"])
                      ])
                    ])
                  ])
                ], 2 /* CLASS */))
          ])
        ], 512 /* NEED_PATCH */), [
          [_vShow, isAgentWorkspaceActive()]
        ]),
        _withDirectives(_createElementVNode("div", { class: "analysis-map-stage" }, [
          (sidebarView === 'wizard' && step === 2)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "h3-map-toolbar"
              }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "h3-map-tool-btn h3-map-save-btn",
                  onClick: saveAndRestart,
                  title: "保存并开启新分析"
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    class: "h3-map-tool-icon",
                    viewBox: "0 0 24 24",
                    "aria-hidden": "true"
                  }, [
                    _createElementVNode("path", { d: "M4 5.5A1.5 1.5 0 0 1 5.5 4h10.2l4.3 4.3V18.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" }),
                    _createElementVNode("path", { d: "M8 4.5v5h7v-5" }),
                    _createElementVNode("path", { d: "M8 20v-5h8v5" })
                  ])),
                  _createElementVNode("span", { class: "h3-map-tool-text" }, "保存并新建")
                ], 8 /* PROPS */, ["onClick"]),
                _createElementVNode("div", { class: "h3-simplify-wrap" }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(["h3-map-tool-btn h3-map-simplify-btn", { active: h3SimplifyMenuOpen }]),
                    onClick: _withModifiers(toggleSimplifyMenu, ["stop"]),
                    title: "显示配置"
                  }, [
                    (_openBlock(), _createElementBlock("svg", {
                      class: "h3-map-tool-icon",
                      viewBox: "0 0 24 24",
                      "aria-hidden": "true"
                    }, [
                      _createElementVNode("path", { d: "M4 7h16" }),
                      _createElementVNode("path", { d: "M4 12h16" }),
                      _createElementVNode("path", { d: "M4 17h16" })
                    ])),
                    _createElementVNode("span", { class: "h3-map-tool-text" }, "显示"),
                    (_openBlock(), _createElementBlock("svg", {
                      class: "h3-map-tool-caret",
                      viewBox: "0 0 24 24",
                      "aria-hidden": "true"
                    }, [
                      _createElementVNode("path", { d: "m6 9 6 6 6-6" })
                    ]))
                  ], 10 /* CLASS, PROPS */, ["onClick"]),
                  h3SimplifyMenuOpen
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "h3-simplify-menu"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(getVisibleSimplifyOptions(), (option) => {
                          return (_openBlock(), _createElementBlock("label", {
                            key: 'simplify-' + option.value,
                            class: "h3-simplify-check"
                          }, [
                            _createElementVNode("input", {
                              type: "checkbox",
                              checked: h3SimplifyTargets.includes(option.value),
                              onChange: $event => (onSimplifyTargetToggle(option.value, $event.target.checked))
                            }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                            _createElementVNode("span", {
                              textContent: _toDisplayString(option.label)
                            }, null, 8 /* PROPS */, ["textContent"])
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "h3-export-wrap" }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(["h3-map-tool-btn h3-map-export-btn", { active: h3ExportMenuOpen }]),
                    onClick: _withModifiers(toggleH3ExportMenu, ["stop"]),
                    title: "导出"
                  }, [
                    (_openBlock(), _createElementBlock("svg", {
                      class: "h3-map-tool-icon",
                      viewBox: "0 0 24 24",
                      "aria-hidden": "true"
                    }, [
                      _createElementVNode("path", { d: "M12 4v10" }),
                      _createElementVNode("path", { d: "M8.5 10.5 12 14l3.5-3.5" }),
                      _createElementVNode("path", { d: "M5 18h14" })
                    ])),
                    _createElementVNode("span", { class: "h3-map-tool-text" }, "导出"),
                    (_openBlock(), _createElementBlock("svg", {
                      class: "h3-map-tool-caret",
                      viewBox: "0 0 24 24",
                      "aria-hidden": "true"
                    }, [
                      _createElementVNode("path", { d: "m6 9 6 6 6-6" })
                    ]))
                  ], 10 /* CLASS, PROPS */, ["onClick"]),
                  h3ExportMenuOpen
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "h3-export-menu"
                      }, [
                        _createElementVNode("div", { class: "h3-export-head" }, [
                          _createElementVNode("div", { class: "h3-export-field-label" }, "导出内容"),
                          _createElementVNode("button", {
                            type: "button",
                            class: _normalizeClass(["h3-export-icon-btn", { 'is-active': isAllAvailableExportPartsSelected() }]),
                            disabled: isExportingBundle || !getSelectableExportParts().length,
                            title: isAllAvailableExportPartsSelected() ? '取消全选可导出项' : '一键全选可导出项',
                            onClick: toggleSelectAllExportParts
                          }, [
                            (_openBlock(), _createElementBlock("svg", {
                              viewBox: "0 0 24 24",
                              "aria-hidden": "true"
                            }, [
                              _createElementVNode("rect", {
                                x: "4",
                                y: "5",
                                width: "4",
                                height: "4",
                                rx: "1.2"
                              }),
                              _createElementVNode("rect", {
                                x: "4",
                                y: "10",
                                width: "4",
                                height: "4",
                                rx: "1.2"
                              }),
                              _createElementVNode("rect", {
                                x: "4",
                                y: "15",
                                width: "4",
                                height: "4",
                                rx: "1.2"
                              }),
                              _createElementVNode("path", { d: "M11 7h8" }),
                              _createElementVNode("path", { d: "M11 12h8" }),
                              _createElementVNode("path", { d: "M11 17h8" }),
                              _createElementVNode("path", { d: "m5.2 12 1.3 1.3 2.1-2.3" }),
                              _createElementVNode("path", { d: "m5.2 17 1.3 1.3 2.1-2.3" })
                            ]))
                          ], 10 /* CLASS, PROPS */, ["disabled", "title", "onClick"])
                        ]),
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(exportBundleGroups, (group) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: `bundle-group-${group.group_key}`,
                            class: "h3-export-group"
                          }, [
                            _createElementVNode("div", { class: "h3-export-group-head" }, [
                              _createElementVNode("input", {
                                type: "checkbox",
                                class: "h3-export-group-checkbox",
                                checked: isExportBundleGroupAllSelected(group.group_key),
                                ".indeterminate": isExportBundleGroupPartiallySelected(group.group_key),
                                disabled: isExportingBundle || !getSelectableExportPartsByGroup(group.group_key).length,
                                onChange: $event => (toggleExportBundleGroupSelection(group.group_key))
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", ".indeterminate", "disabled", "onChange"]),
                              _createElementVNode("button", {
                                type: "button",
                                class: "h3-export-group-title",
                                onClick: $event => (toggleExportBundleGroupExpanded(group.group_key))
                              }, [
                                _createElementVNode("span", null, _toDisplayString(group.group_label), 1 /* TEXT */),
                                (_openBlock(), _createElementBlock("svg", {
                                  viewBox: "0 0 24 24",
                                  "aria-hidden": "true",
                                  class: _normalizeClass({ 'is-open': isExportBundleGroupExpanded(group.group_key) })
                                }, [
                                  _createElementVNode("path", { d: "m6 9 6 6 6-6" })
                                ], 2 /* CLASS */))
                              ], 8 /* PROPS */, ["onClick"])
                            ]),
                            (isExportBundleGroupExpanded(group.group_key))
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "h3-export-group-body"
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(group.children, (item) => {
                                    return (_openBlock(), _createElementBlock("label", {
                                      key: `bundle-item-${group.group_key}-${item.value}`,
                                      class: "h3-export-check h3-export-check-child"
                                    }, [
                                      _withDirectives(_createElementVNode("input", {
                                        type: "checkbox",
                                        value: item.value,
                                        "onUpdate:modelValue": $event => ((exportBundleParts) = $event),
                                        disabled: isExportBundlePartDisabled(item.value),
                                        title: getExportBundlePartDisabledReason(item.value)
                                      }, null, 8 /* PROPS */, ["value", "onUpdate:modelValue", "disabled", "title"]), [
                                        [_vModelCheckbox, exportBundleParts]
                                      ]),
                                      _createElementVNode("span", null, _toDisplayString(item.label), 1 /* TEXT */)
                                    ]))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        }), 128 /* KEYED_FRAGMENT */)),
                        _createElementVNode("button", {
                          type: "button",
                          class: "h3-export-item",
                          disabled: isExportingBundle || !exportBundleParts.length,
                          onClick: $event => (exportAnalysisBundle())
                        }, _toDisplayString(isExportingBundle ? '导出中...' : '导出 ZIP'), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                      ]))
                    : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "h3-task-wrap" }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(["h3-map-tool-btn h3-map-task-btn", { active: h3ExportTasksOpen }]),
                    onClick: toggleH3ExportTasks,
                    title: "导出任务"
                  }, [
                    (_openBlock(), _createElementBlock("svg", {
                      class: "h3-map-tool-icon",
                      viewBox: "0 0 24 24",
                      "aria-hidden": "true"
                    }, [
                      _createElementVNode("rect", {
                        x: "4",
                        y: "5",
                        width: "16",
                        height: "14",
                        rx: "2"
                      }),
                      _createElementVNode("path", { d: "M8 10h8" }),
                      _createElementVNode("path", { d: "M8 14h6" })
                    ])),
                    _createElementVNode("span", { class: "h3-map-tool-text" }, "任务"),
                    (getH3PendingTaskCount() > 0)
                      ? (_openBlock(), _createElementBlock("span", {
                          key: 0,
                          class: "h3-task-count"
                        }, _toDisplayString(getH3PendingTaskCount()), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ], 10 /* CLASS, PROPS */, ["onClick"])
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["h3-map-tool-btn h3-map-debug-btn", { active: isochroneDebugOpen }]),
                  disabled: isLoadingIsochroneDebug || (!isochroneDebugOpen && !isIsochroneDebugAvailable()),
                  title: getIsochroneDebugButtonTitle(),
                  onClick: toggleIsochroneDebug
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    class: "h3-map-tool-icon",
                    viewBox: "0 0 24 24",
                    "aria-hidden": "true"
                  }, [
                    _createElementVNode("path", { d: "M12 2.8v4.2" }),
                    _createElementVNode("path", { d: "M12 17v4.2" }),
                    _createElementVNode("path", { d: "M2.8 12H7" }),
                    _createElementVNode("path", { d: "M17 12h4.2" }),
                    _createElementVNode("circle", {
                      cx: "12",
                      cy: "12",
                      r: "5.2"
                    }),
                    _createElementVNode("circle", {
                      cx: "12",
                      cy: "12",
                      r: "1.4"
                    })
                  ])),
                  _createElementVNode("span", { class: "h3-map-tool-text" }, _toDisplayString(isLoadingIsochroneDebug ? '调试中...' : '调试'), 1 /* TEXT */)
                ], 10 /* CLASS, PROPS */, ["disabled", "title", "onClick"])
              ]))
            : _createCommentVNode("v-if", true),
          (sidebarView === 'wizard' && step === 2 && h3ExportTasksOpen)
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "h3-export-task-panel"
              }, [
                _createElementVNode("div", { class: "h3-export-task-panel-header" }, [
                  _createElementVNode("span", null, "导出任务"),
                  _createElementVNode("button", {
                    type: "button",
                    class: "h3-export-task-close",
                    onClick: closeH3ExportTasks
                  }, "关闭", 8 /* PROPS */, ["onClick"])
                ]),
                (!h3ExportTasks.length)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "h3-export-task-empty"
                    }, "暂无任务"))
                  : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(h3ExportTasks, (task) => {
                        return (_openBlock(), _createElementBlock("div", {
                          key: task.id,
                          class: "h3-export-task-item"
                        }, [
                          _createElementVNode("div", { class: "h3-export-task-row" }, [
                            _createElementVNode("div", { class: "h3-export-task-name" }, _toDisplayString(task.title), 1 /* TEXT */),
                            _createElementVNode("span", {
                              class: _normalizeClass(["h3-export-task-state", {
                                    'is-running': task.status === 'running',
                                    'is-success': task.status === 'success',
                                    'is-failed': task.status === 'failed'
                                }])
                            }, _toDisplayString(task.status_label), 3 /* TEXT, CLASS */)
                          ]),
                          _createElementVNode("div", { class: "h3-export-task-progress" }, [
                            _createElementVNode("div", {
                              class: "h3-export-task-progress-bar",
                              style: _normalizeStyle({ width: `${Math.max(0, Math.min(100, Number(task.progress_pct || 0)))}%` })
                            }, null, 4 /* STYLE */)
                          ]),
                          _createElementVNode("div", { class: "h3-export-task-meta" }, _toDisplayString(task.scope_label) + " · " + _toDisplayString(task.created_at_text), 1 /* TEXT */),
                          (task.progress_label)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "h3-export-task-meta"
                              }, _toDisplayString(task.progress_label), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                          (task.filename)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "h3-export-task-meta"
                              }, " 文件：" + _toDisplayString(task.filename), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                          (task.error)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 2,
                                class: "h3-export-task-error"
                              }, _toDisplayString(task.error), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                        ]))
                      }), 128 /* KEYED_FRAGMENT */)),
                      _createElementVNode("div", { class: "h3-export-task-actions" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: "h3-export-task-clear",
                          onClick: clearH3CompletedTasks
                        }, "清理已完成", 8 /* PROPS */, ["onClick"])
                      ])
                    ], 64 /* STABLE_FRAGMENT */))
              ]))
            : _createCommentVNode("v-if", true),
          (sidebarView === 'wizard' && step === 2 && h3Toast.message)
            ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: _normalizeClass(["h3-export-toast", {
                    'is-success': h3Toast.type === 'success',
                    'is-error': h3Toast.type === 'error',
                    'is-warning': h3Toast.type === 'warning'
                }])
              }, _toDisplayString(h3Toast.message), 3 /* TEXT, CLASS */))
            : _createCommentVNode("v-if", true),
          (sidebarView === 'wizard')
            ? (_openBlock(), _createElementBlock("button", {
                key: 3,
                type: "button",
                class: "map-recenter-btn",
                title: "回到中心",
                "aria-label": "回到中心",
                disabled: !mapCore || !mapCore.map,
                onClick: goMapBackToCenter
              }, [
                (_openBlock(), _createElementBlock("svg", {
                  viewBox: "0 0 24 24",
                  "aria-hidden": "true"
                }, [
                  _createElementVNode("circle", {
                    cx: "12",
                    cy: "12",
                    r: "3.2"
                  }),
                  _createElementVNode("path", { d: "M12 2.8v3.4" }),
                  _createElementVNode("path", { d: "M12 17.8v3.4" }),
                  _createElementVNode("path", { d: "M2.8 12h3.4" }),
                  _createElementVNode("path", { d: "M17.8 12h3.4" })
                ]))
              ], 8 /* PROPS */, ["disabled", "onClick"]))
            : _createCommentVNode("v-if", true),
          _createElementVNode("div", {
            id: "tianditu-container",
            "aria-hidden": "true"
          }),
          _createElementVNode("div", { id: "container" }),
          (basemapSource === 'osm')
            ? (_openBlock(), _createElementBlock("div", {
                key: 4,
                style: {"position":"absolute","right":"8px","bottom":"6px","z-index":"2","background":"rgba(255,255,255,0.9)","border":"1px solid #e5e7eb","border-radius":"6px","padding":"2px 6px","font-size":"10px","color":"#4b5563"}
              }, " © OpenStreetMap contributors "))
            : (basemapSource === 'tianditu')
              ? (_openBlock(), _createElementBlock("div", {
                  key: 5,
                  style: {"position":"absolute","right":"8px","bottom":"6px","z-index":"2","background":"rgba(255,255,255,0.9)","border":"1px solid #e5e7eb","border-radius":"6px","padding":"2px 6px","font-size":"10px","color":"#4b5563"}
                }, " © 天地图 "))
              : _createCommentVNode("v-if", true)
        ], 512 /* NEED_PATCH */), [
          [_vShow, !isAgentWorkspaceActive()]
        ])
      ], 2 /* CLASS */)
    ], 64 /* STABLE_FRAGMENT */))
  }
}