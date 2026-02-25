(function (window, MapUtils) {
    function FilterPanel(markerManager, config) {
        this.markerManager = markerManager;
        this.mapCore = (config && config.mapCore) || markerManager.mapCore;
        this.mapData = (config && config.mapData) || {};
        this.mapTypeConfig = (config && config.mapTypeConfig) || {};
        this.flatMode = (config && config.flatMode) || false;
        this.autoFitView = (config && Object.prototype.hasOwnProperty.call(config, 'autoFitView'))
            ? !!config.autoFitView
            : true;

        this.filterGroups = [];
        this.typeCountMap = {};
        this.groupCountMap = {};
        this.pointRowMap = {};
        this.pointListElMap = {};
        this.groupMetaMap = {};
        this.renderedTypePointRows = {};
        this.groupExpandState = {};
        this.typeExpandState = {};
        this.typeToGroupMap = {};
        this.onFiltersChange = null;
        this._applyFiltersToken = 0;

        this.poiTotalCountEl = document.getElementById('poiTotalCount');
        this.toggleAllPoiBtn = document.getElementById('toggleAllPoi');
        this.toggleNamesBtn = document.getElementById('toggleNames');
        this.toggleAllBtn = document.getElementById('toggleAll');
        this.toggleExpandAllBtn = document.getElementById('toggleExpandAll');

        this.markerManager.setMarkerClickHandler(function (pid) {
            this.focusPointInPanel(pid, false);
        }.bind(this));
    }

    FilterPanel.prototype.bindExclusiveClick = function (el, handler) {
        if (!el || typeof handler !== 'function') return;
        // Use onclick assignment to avoid accumulating listeners across panel re-inits.
        el.onclick = handler;
    };

    FilterPanel.prototype.replaceNodeToDropLegacyListeners = function (el) {
        if (!el || !el.parentNode) return el || null;
        var cloned = el.cloneNode(true);
        try {
            el.parentNode.replaceChild(cloned, el);
            return cloned;
        } catch (_) {
            return el;
        }
    };

    FilterPanel.prototype.refreshGlobalControlRefs = function () {
        this.poiTotalCountEl = document.getElementById('poiTotalCount');
        this.toggleAllPoiBtn = this.replaceNodeToDropLegacyListeners(document.getElementById('toggleAllPoi'));
        this.toggleNamesBtn = this.replaceNodeToDropLegacyListeners(document.getElementById('toggleNames'));
        this.toggleAllBtn = this.replaceNodeToDropLegacyListeners(document.getElementById('toggleAll'));
        this.toggleExpandAllBtn = this.replaceNodeToDropLegacyListeners(document.getElementById('toggleExpandAll'));
    };

    FilterPanel.prototype.init = function () {
        this.refreshGlobalControlRefs();
        this.buildFilters();
        Object.keys(this.groupExpandState).forEach(function (gid) {
            this.setGroupExpanded(gid, false);
        }, this);
        Object.keys(this.typeExpandState).forEach(function (tid) {
            this.setTypeExpanded(tid, false);
        }, this);
        this.attachFilterListeners();
        this.updateExpandAllButtonText();
        if (this.toggleNamesBtn) {
            this.toggleNamesBtn.textContent = this.markerManager.labelsVisible ? '隐藏名称' : '显示名称';
        }
        this.updateActiveTypes();
        this.updateTypeCountDisplay();
    };

    FilterPanel.prototype.buildFilters = function () {
        var container = document.getElementById('filtersContainer');
        if (!container) return;
        var pointsByType = this.markerManager.getPointsByType();
        var existingTypes = this.markerManager.getExistingTypes();

        container.innerHTML = '';
        container.classList.toggle('modern-poi-tree', !this.flatMode);
        this.filterGroups = [];
        this.typeCountMap = {};
        this.groupCountMap = {};
        this.pointRowMap = {};
        this.pointListElMap = {};
        this.groupMetaMap = {};
        this.renderedTypePointRows = {};
        this.typeToGroupMap = {};

        if (this.flatMode) {
            var flatItems = [];
            (this.mapTypeConfig.groups || []).forEach(function (group) {
                (group.items || []).forEach(function (item) {
                    flatItems.push({
                        groupId: group.id,
                        item: item
                    });
                });
            });

            flatItems.forEach(function (entry) {
                var item = entry.item;
                var section = document.createElement('div');
                section.className = 'filter-section poi-type-card';

                var header = document.createElement('div');
                header.className = 'poi-type-header';

                var titleWrap = document.createElement('div');
                titleWrap.className = 'poi-type-title';

                var colorDot = document.createElement('span');
                colorDot.className = 'color-dot';
                colorDot.style.background = item.color || '#888';

                var titleText = document.createElement('span');
                titleText.textContent = item.label;

                titleWrap.appendChild(colorDot);
                titleWrap.appendChild(titleText);

                var actions = document.createElement('div');
                actions.className = 'poi-type-actions';

                var countSpan = document.createElement('span');
                countSpan.className = 'type-count badge';
                countSpan.textContent = '(0)';
                this.typeCountMap[item.id] = countSpan;
                actions.appendChild(countSpan);

                var toggleInput = document.createElement('input');
                toggleInput.type = 'checkbox';
                toggleInput.id = 'flat-' + item.id;
                toggleInput.value = item.id;
                toggleInput.className = 'type-checkbox';
                toggleInput.checked = item.defaultChecked !== false && existingTypes.has(item.id);
                toggleInput.style.display = 'none';

                var expandBtn = document.createElement('button');
                expandBtn.className = 'expand-btn';
                expandBtn.dataset.typeExpandBtn = item.id;
                expandBtn.title = '展开子项';
                var expandIcon = document.createElement('img');
                expandIcon.src = '/static/images/chevron.svg';
                expandIcon.alt = '展开';
                expandIcon.className = 'expand-icon';
                expandBtn.appendChild(expandIcon);
                actions.appendChild(expandBtn);

                header.appendChild(titleWrap);
                header.appendChild(actions);

                var pointList = document.createElement('div');
                pointList.className = 'point-list';
                pointList.dataset.typeId = item.id;
                pointList.id = 'type-list-' + item.id;
                this.pointListElMap[item.id] = pointList;

                (pointsByType[item.id] || []).forEach(function (pt) {
                    var row = document.createElement('div');
                    row.className = 'point-item';
                    row.dataset.pid = pt._pid;
                    row.dataset.typeId = item.id;
                    row.dataset.groupId = entry.groupId;

                    var pointToggle = document.createElement('input');
                    pointToggle.type = 'checkbox';
                    pointToggle.checked = this.markerManager.isPointEnabled(pt);
                    pointToggle.addEventListener('change', function () {
                        var disabled = !pointToggle.checked;
                        this.markerManager.setPointDisabled(pt._pid, disabled);
                        this.applyFilters();
                        this.updateTypeCountDisplay();
                        row.classList.toggle('disabled', disabled);
                    }.bind(this));

                    var nameSpan = document.createElement('span');
                    nameSpan.className = 'point-name';
                    nameSpan.textContent = pt.name;
                    nameSpan.addEventListener('click', function () {
                        var typeCheckbox = document.getElementById('flat-' + item.id);
                        if (typeCheckbox && !typeCheckbox.checked) {
                            typeCheckbox.checked = true;
                            this.updateActiveTypes();
                        }
                        this.markerManager.focusMarkerOnMap(pt._pid, true);
                        this.focusPointInPanel(pt._pid, false);
                    }.bind(this));

                    row.appendChild(pointToggle);
                    row.appendChild(nameSpan);
                    row.classList.toggle('disabled', !this.markerManager.isPointEnabled(pt));
                    pointList.appendChild(row);
                    this.pointRowMap[pt._pid] = row;
                }.bind(this));

                this.typeExpandState[item.id] = false;
                this.renderedTypePointRows[item.id] = true;
                section.appendChild(header);
                section.appendChild(toggleInput);
                if (pointList.childElementCount > 0) {
                    pointList.classList.add('collapsed');
                    section.appendChild(pointList);
                } else {
                    expandBtn.style.visibility = 'hidden';
                }

                container.appendChild(section);
            }.bind(this));

            return;
        }

        (this.mapTypeConfig.groups || []).forEach(function (group) {
            if (!group || !group.id) return;
            var section = document.createElement('div');
            section.className = 'filter-section poi-group-card poi-group-accordion';

            var header = document.createElement('div');
            header.className = 'poi-group-header';

            var titleSpan = document.createElement('div');
            titleSpan.className = 'poi-group-title';
            titleSpan.textContent = group.title;
            var groupColor = '#888';
            if (group.items && group.items.length && group.items[0] && group.items[0].color) {
                groupColor = group.items[0].color;
            }

            var groupCount = 0;
            (group.items || []).forEach(function (item) {
                groupCount += (pointsByType[item.id] || []).length;
            });

            var titleWrap = document.createElement('div');
            titleWrap.className = 'poi-group-title-wrap';
            var groupColorDot = document.createElement('span');
            groupColorDot.className = 'group-color-dot';
            groupColorDot.style.background = groupColor;
            titleWrap.appendChild(groupColorDot);
            titleWrap.appendChild(titleSpan);

            var actions = document.createElement('div');
            actions.className = 'poi-group-actions';

            var groupCountSpan = document.createElement('span');
            groupCountSpan.className = 'group-count badge';
            groupCountSpan.textContent = '' + groupCount;
            actions.appendChild(groupCountSpan);
            this.groupCountMap[group.id] = groupCountSpan;

            var toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.id = group.toggleId;
            toggleInput.className = 'group-toggle';
            toggleInput.style.display = 'none';
            actions.appendChild(toggleInput);

            var expandBtn = document.createElement('button');
            expandBtn.className = 'expand-btn poi-expand-btn';
            expandBtn.dataset.expandBtn = group.id;
            expandBtn.title = '展开';
            expandBtn.setAttribute('aria-expanded', 'false');
            var expandIcon = document.createElement('img');
            expandIcon.src = '/static/images/chevron.svg';
            expandIcon.alt = '展开';
            expandIcon.className = 'expand-icon';
            expandBtn.appendChild(expandIcon);
            actions.appendChild(expandBtn);

            header.appendChild(titleWrap);
            header.appendChild(actions);
            header.dataset.groupId = group.id;
            header.setAttribute('role', 'button');
            header.setAttribute('tabindex', '0');
            header.setAttribute('aria-label', group.title + ' 分类切换');

            var groupDiv = document.createElement('div');
            groupDiv.className = 'filter-group';
            groupDiv.id = group.filtersId;
            this.groupMetaMap[group.id] = {
                filtersId: group.filtersId,
                toggleId: group.toggleId
            };

            var groupContent = document.createElement('div');
            groupContent.className = 'group-content';
            groupContent.id = group.id + '-content';

            (group.items || []).forEach(function (item) {
                if (!item || !item.id) return;
                var itemContainer = document.createElement('div');
                itemContainer.className = 'type-block poi-type-card-modern';
                itemContainer.dataset.typeCard = item.id;
                this.typeToGroupMap[item.id] = group.id;

                var option = document.createElement('div');
                option.className = 'filter-option poi-type-row';
                option.dataset.typeId = item.id;
                option.setAttribute('role', 'button');
                option.setAttribute('tabindex', '0');
                option.setAttribute('aria-label', item.label + ' 分类切换');

                var input = document.createElement('input');
                input.type = 'checkbox';
                input.id = group.id + '-' + item.id;
                input.value = item.id;
                input.className = 'type-checkbox';
                input.checked = item.defaultChecked !== false && existingTypes.has(item.id);
                input.style.display = 'none';

                var label = document.createElement('label');
                label.className = 'poi-type-label';
                var labelText = document.createElement('span');
                labelText.className = 'poi-type-label-text';
                labelText.textContent = item.label;
                var countSpan = document.createElement('span');
                countSpan.className = 'type-count badge';
                countSpan.textContent = '0';
                this.typeCountMap[item.id] = countSpan;
                label.appendChild(labelText);
                label.appendChild(countSpan);

                var typeExpandBtn = document.createElement('button');
                typeExpandBtn.className = 'expand-btn poi-expand-btn';
                typeExpandBtn.dataset.typeExpandBtn = item.id;
                typeExpandBtn.title = '展开子项';
                typeExpandBtn.setAttribute('aria-expanded', 'false');
                var typeExpandIcon = document.createElement('img');
                typeExpandIcon.src = '/static/images/chevron.svg';
                typeExpandIcon.alt = '展开';
                typeExpandIcon.className = 'expand-icon';
                typeExpandBtn.appendChild(typeExpandIcon);

                option.appendChild(input);
                option.appendChild(label);
                option.appendChild(typeExpandBtn);

                var pointList = document.createElement('div');
                pointList.className = 'point-list';
                pointList.dataset.typeId = item.id;
                pointList.id = 'type-list-' + item.id;
                this.pointListElMap[item.id] = pointList;

                this.typeExpandState[item.id] = false;
                this.renderedTypePointRows[item.id] = false;
                itemContainer.appendChild(option);
                if ((pointsByType[item.id] || []).length > 0) {
                    pointList.classList.add('collapsed');
                    itemContainer.appendChild(pointList);
                } else {
                    this.renderedTypePointRows[item.id] = true;
                    typeExpandBtn.style.visibility = 'hidden';
                }
                groupDiv.appendChild(itemContainer);
            }.bind(this));

            section.appendChild(header);
            groupContent.appendChild(groupDiv);
            section.appendChild(groupContent);
            container.appendChild(section);

            this.groupExpandState[group.id] = false;
            this.filterGroups.push({ group: '#' + group.filtersId, button: group.toggleId, groupId: group.id, expandBtn: expandBtn, headerEl: header });
            this.updateToggleButtonText('#' + group.filtersId, group.toggleId);
        }.bind(this));
    };

    FilterPanel.prototype.buildPointRow = function (pt, typeId, groupId) {
        var row = document.createElement('div');
        row.className = 'point-item';
        row.dataset.pid = pt._pid;
        row.dataset.typeId = typeId;
        row.dataset.groupId = groupId;

        var pointToggle = document.createElement('input');
        pointToggle.type = 'checkbox';
        pointToggle.className = 'point-checkbox';
        pointToggle.id = 'point-toggle-' + pt._pid;
        pointToggle.checked = this.markerManager.isPointEnabled(pt);
        row.appendChild(pointToggle);

        var nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.className = 'point-name-btn';
        nameBtn.textContent = pt.name;
        nameBtn.addEventListener('click', function () {
            var typeCheckbox = document.getElementById(groupId + '-' + typeId);
            if (typeCheckbox && !typeCheckbox.checked) {
                typeCheckbox.checked = true;
                typeCheckbox.indeterminate = false;
                this.syncPointsWithType(typeCheckbox.value, true, { deferRefresh: true });
                this.updateActiveTypes();
                var groupMeta = this.groupMetaMap[groupId];
                if (groupMeta) {
                    this.updateToggleButtonText('#' + groupMeta.filtersId, groupMeta.toggleId);
                }
            }
            this.markerManager.focusMarkerOnMap(pt._pid, true);
            this.focusPointInPanel(pt._pid, false);
        }.bind(this));
        row.appendChild(nameBtn);

        pointToggle.addEventListener('change', function () {
            var disabled = !pointToggle.checked;
            this.markerManager.setPointDisabled(pt._pid, disabled);
            this.updateActiveTypes();
            row.classList.toggle('disabled', disabled);
        }.bind(this));

        row.classList.toggle('disabled', !this.markerManager.isPointEnabled(pt));
        this.pointRowMap[pt._pid] = row;
        return row;
    };

    FilterPanel.prototype.ensureTypePointRows = function (typeId) {
        if (!typeId) return;
        if (this.renderedTypePointRows[typeId]) return;

        var listEl = this.pointListElMap[typeId] || document.getElementById('type-list-' + typeId);
        if (!listEl) return;

        var groupId = this.typeToGroupMap[typeId] || '';
        var points = this.markerManager.getPointsByType()[typeId] || [];
        points.forEach(function (pt) {
            var row = this.buildPointRow(pt, typeId, groupId);
            listEl.appendChild(row);
        }, this);

        this.renderedTypePointRows[typeId] = true;
    };

    FilterPanel.prototype.syncPointsWithType = function (typeId, enabled, options) {
        var opts = options || {};
        var list = this.markerManager.getPointsByType()[typeId] || [];
        var self = this;
        list.forEach(function (pt) {
            self.markerManager.setPointDisabled(pt._pid, !enabled);
            var row = self.pointRowMap[pt._pid];
            if (row) {
                var pointToggle = row.querySelector('input[type="checkbox"].point-checkbox') || row.querySelector('input[type="checkbox"]');
                if (pointToggle) {
                    pointToggle.checked = enabled;
                    pointToggle.indeterminate = false;
                }
                row.classList.toggle('disabled', !enabled);
            }
        });
        this.setTypeExpanded(typeId, enabled ? (this.typeExpandState[typeId] !== false) : false);
        if (!opts.deferRefresh) {
            this.updateActiveTypes();
        }
    };

    FilterPanel.prototype.setGroupExpanded = function (groupId, expanded) {
        this.groupExpandState[groupId] = expanded;
        var content = document.getElementById(groupId + '-content');
        var btn = document.querySelector('[data-expand-btn="' + groupId + '"]');
        if (content) {
            if (expanded) {
                content.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
            }
        }
        if (btn) {
            btn.title = expanded ? '收起' : '展开';
            btn.classList.toggle('expanded', expanded);
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    };

    FilterPanel.prototype.updateExpandAllButtonText = function () {
        if (!this.toggleExpandAllBtn) return;
        var keys = this.flatMode ? Object.keys(this.typeExpandState) : Object.keys(this.groupExpandState);
        var allExpanded = keys.length && keys.every(function (k) {
            return this.flatMode ? this.typeExpandState[k] !== false : this.groupExpandState[k];
        }, this);
        this.toggleExpandAllBtn.textContent = allExpanded ? '全部收起' : '全部展开';
        this.toggleExpandAllBtn.title = allExpanded ? '全部收起' : '全部展开';
    };

    FilterPanel.prototype.toggleAllGroupExpand = function () {
        if (this.flatMode) {
            var typeKeys = Object.keys(this.typeExpandState);
            var targetExpand = typeKeys.some(function (k) { return !this.typeExpandState[k]; }, this);
            typeKeys.forEach(function (k) {
                this.setTypeExpanded(k, targetExpand);
            }, this);
        } else {
            var keys = Object.keys(this.groupExpandState);
            var targetExpand = keys.some(function (k) { return !this.groupExpandState[k]; }, this);
            var self = this;
            keys.forEach(function (k) {
                self.setGroupExpanded(k, targetExpand);
            });
        }
        this.updateExpandAllButtonText();
    };

    FilterPanel.prototype.setTypeExpanded = function (typeId, expanded) {
        this.typeExpandState[typeId] = expanded;
        var listEl = document.getElementById('type-list-' + typeId);
        var btn = document.querySelector('[data-type-expand-btn="' + typeId + '"]');
        if (expanded) {
            this.ensureTypePointRows(typeId);
        }
        if (listEl) {
            if (expanded) {
                listEl.classList.remove('collapsed');
            } else {
                listEl.classList.add('collapsed');
            }
        }
        if (btn) {
            btn.title = expanded ? '收起子项' : '展开子项';
            btn.classList.toggle('expanded', expanded);
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    };

    FilterPanel.prototype.attachFilterListeners = function () {
        var self = this;

        if (this.flatMode) {
            var flatCheckboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
            flatCheckboxes.forEach(function (checkbox) {
                checkbox.addEventListener('change', function () {
                    self.syncPointsWithType(checkbox.value, checkbox.checked, { deferRefresh: true });
                    self.updateActiveTypes();
                    self.updateToggleAllPoiText();
                });
            });

            var headers = document.querySelectorAll('#filtersContainer .poi-type-header');
            headers.forEach(function (header) {
                header.addEventListener('click', function () {
                    var card = header.closest('.poi-type-card');
                    if (!card) return;
                    var checkbox = card.querySelector('input[type="checkbox"].type-checkbox');
                    if (!checkbox) return;
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                });
            });

            var typeExpandBtns = document.querySelectorAll('#filtersContainer .expand-btn[data-type-expand-btn]');
            typeExpandBtns.forEach(function (btn) {
                btn.addEventListener('click', function (event) {
                    if (event && event.stopPropagation) {
                        event.stopPropagation();
                    }
                    var typeId = btn.dataset.typeExpandBtn;
                    self.setTypeExpanded(typeId, !self.typeExpandState[typeId]);
                    self.updateExpandAllButtonText();
                });
            });
        } else {
            this.filterGroups.forEach(function (item) {
                var checkboxes = document.querySelectorAll(item.group + ' input[type="checkbox"].type-checkbox');
                checkboxes.forEach(function (checkbox) {
                    checkbox.addEventListener('change', function () {
                        self.syncPointsWithType(checkbox.value, checkbox.checked, { deferRefresh: true });
                        self.updateToggleButtonText(item.group, item.button);
                        self.updateActiveTypes();
                    });
                });

                if (item.headerEl) {
                    var onGroupToggle = function () {
                        self.toggleAllInGroup(item.group, item.button);
                    };
                    item.headerEl.addEventListener('click', onGroupToggle);
                    item.headerEl.addEventListener('keydown', function (event) {
                        if (!event) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onGroupToggle();
                        }
                    });
                }

                var typeExpandBtns = document.querySelectorAll(item.group + ' .expand-btn[data-type-expand-btn]');
                typeExpandBtns.forEach(function (btn) {
                    btn.addEventListener('click', function (event) {
                        if (event && event.stopPropagation) {
                            event.stopPropagation();
                        }
                        var typeId = btn.dataset.typeExpandBtn;
                        self.setTypeExpanded(typeId, !self.typeExpandState[typeId]);
                    });
                });

                var typeRows = document.querySelectorAll(item.group + ' .poi-type-row');
                typeRows.forEach(function (row) {
                    var typeCheckbox = row.querySelector('input[type="checkbox"].type-checkbox');
                    if (!typeCheckbox) return;
                    var onTypeToggle = function () {
                        typeCheckbox.indeterminate = false;
                        typeCheckbox.checked = !typeCheckbox.checked;
                        typeCheckbox.dispatchEvent(new Event('change'));
                    };
                    row.addEventListener('click', function () {
                        onTypeToggle();
                    });
                    row.addEventListener('keydown', function (event) {
                        if (!event) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onTypeToggle();
                        }
                    });
                });

                var toggleBtn = document.getElementById(item.button);
                if (toggleBtn) {
                    toggleBtn.addEventListener('change', function () {
                        self.toggleAllInGroup(item.group, item.button, toggleBtn.checked);
                    });
                }

                if (item.expandBtn) {
                    item.expandBtn.addEventListener('click', function (event) {
                        if (event && event.stopPropagation) {
                            event.stopPropagation();
                        }
                        var target = !self.groupExpandState[item.groupId];
                        self.setGroupExpanded(item.groupId, target);
                        self.updateExpandAllButtonText();
                    });
                }
            });
        }

        if (this.toggleExpandAllBtn) {
            this.bindExclusiveClick(this.toggleExpandAllBtn, function () {
                self.toggleAllGroupExpand();
            });
        }

        if (this.toggleNamesBtn) {
            this.bindExclusiveClick(this.toggleNamesBtn, function () {
                var visible = self.markerManager.toggleLabels();
                self.toggleNamesBtn.textContent = visible ? '隐藏名称' : '显示名称';
            });
        }

        if (this.toggleAllBtn) {
            this.bindExclusiveClick(this.toggleAllBtn, function () {
                self.toggleAllTypes();
            });
        }

        if (!this.toggleAllPoiBtn) {
            this.toggleAllPoiBtn = document.getElementById('toggleAllPoi');
        }

        if (this.toggleAllPoiBtn) {
            this.bindExclusiveClick(this.toggleAllPoiBtn, function () {
                self.toggleAllTypes();
                self.updateToggleAllPoiText();
            });
        }

    };

    FilterPanel.prototype.updateToggleButtonText = function (groupId, buttonId) {
        var checkboxes = document.querySelectorAll(groupId + ' input[type="checkbox"].type-checkbox');
        if (!checkboxes.length) return;
        var allChecked = true;
        var anyChecked = false;
        checkboxes.forEach(function (cb) {
            if (!cb.checked) allChecked = false;
            if (cb.checked) anyChecked = true;
        });

        var toggle = document.getElementById(buttonId);
        if (toggle) {
            if (allChecked) {
                toggle.checked = true;
                toggle.indeterminate = false;
            } else if (!anyChecked) {
                toggle.checked = false;
                toggle.indeterminate = false;
            } else {
                toggle.checked = false;
                toggle.indeterminate = true;
            }
        }

        var groupPane = document.querySelector(groupId);
        var groupCard = groupPane ? groupPane.closest('.poi-group-card') : null;
        if (groupCard) {
            groupCard.classList.remove('is-on', 'is-off', 'is-mixed');
            if (allChecked) {
                groupCard.classList.add('is-on');
            } else if (!anyChecked) {
                groupCard.classList.add('is-off');
            } else {
                groupCard.classList.add('is-mixed');
            }
        }
    };

    FilterPanel.prototype.toggleAllInGroup = function (groupId, buttonId, targetChecked) {
        var checkboxes = document.querySelectorAll(groupId + ' input[type="checkbox"].type-checkbox');
        var allChecked = true;
        checkboxes.forEach(function (cb) {
            if (!cb.checked) allChecked = false;
        });

        var desired = typeof targetChecked === 'boolean' ? targetChecked : !allChecked;
        var changed = false;
        checkboxes.forEach(function (cb) {
            if (cb.checked !== desired) {
                cb.checked = desired;
                cb.indeterminate = false;
                this.syncPointsWithType(cb.value, desired, { deferRefresh: true });
                changed = true;
            }
        }, this);
        if (changed) {
            this.updateToggleButtonText(groupId, buttonId);
            this.updateActiveTypes();
            return;
        }
        this.updateToggleButtonText(groupId, buttonId);
    };

    FilterPanel.prototype.toggleAllTypes = function () {
        var checkboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
        if (!checkboxes.length) return;
        var allChecked = true;
        checkboxes.forEach(function (cb) {
            if (!cb.checked || cb.indeterminate) allChecked = false;
        });
        var desired = !allChecked;
        var changed = false;
        checkboxes.forEach(function (cb) {
            if (cb.checked !== desired) {
                cb.checked = desired;
                cb.indeterminate = false;
                this.syncPointsWithType(cb.value, desired, { deferRefresh: true });
                changed = true;
            }
        }, this);
        if (!changed) {
            this.updateToggleAllPoiText();
            return;
        }
        if (!this.flatMode) {
            this.filterGroups.forEach(function (item) {
                this.updateToggleButtonText(item.group, item.button);
            }, this);
        }
        this.updateActiveTypes();
    };

    FilterPanel.prototype.updateActiveTypes = function () {
        var activeTypes = new Set();
        if (this.flatMode) {
            var checkboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
            checkboxes.forEach(function (checkbox) {
                if (checkbox.checked) {
                    activeTypes.add(checkbox.value);
                }
            });
        } else {
            this.filterGroups.forEach(function (item) {
                var checkboxes = document.querySelectorAll(item.group + ' input[type="checkbox"].type-checkbox');
                checkboxes.forEach(function (checkbox) {
                    if (checkbox.checked) {
                        activeTypes.add(checkbox.value);
                    }
                });
            });
        }
        this.markerManager.setActiveTypes(activeTypes);
        this.applyFilters();
    };

    FilterPanel.prototype.applyFilters = function () {
        var self = this;
        this._applyFiltersToken = Number(this._applyFiltersToken || 0) + 1;
        var currentToken = this._applyFiltersToken;
        var finalize = function (result) {
            if (currentToken !== self._applyFiltersToken) {
                return result || { ok: false, skipped: true, reason: 'stale_filter_finalize' };
            }
            var committed = !!(result && result.ok === true && !result.skipped);
            if (self.autoFitView && committed && self.mapCore && typeof self.mapCore.updateFitView === 'function') {
                self.mapCore.updateFitView(self.markerManager.getVisibleMarkers());
            }
            self.updateTypeCountDisplay();
            if (committed && typeof self.onFiltersChange === 'function') {
                self.onFiltersChange(result || null);
            }
            return result || { ok: true, reason: 'filter_finalize' };
        };
        var handle = this.markerManager.applyFilters();
        if (handle && handle.promise && typeof handle.promise.then === 'function') {
            return handle.promise.then(function (result) {
                return finalize(result);
            }).catch(function (err) {
                return finalize({
                    ok: false,
                    reason: 'apply_filters_failed',
                    error: err && err.message ? err.message : String(err)
                });
            });
        }
        return Promise.resolve(finalize({ ok: true, reason: 'apply_filters_sync' }));
    };

    FilterPanel.prototype.updateTypeCountDisplay = function () {
        var counts = this.markerManager.getTypeCounts();
        var visibleCounts = this.computeVisibleCounts ? this.computeVisibleCounts() : {};
        var total = 0;
        Object.keys(this.typeCountMap).forEach(function (typeKey) {
            var span = this.typeCountMap[typeKey];
            if (!span) return;
            var count = counts[typeKey] || 0;
            span.textContent = '' + count;
            total += count;
        }, this);

        (this.mapTypeConfig.groups || []).forEach(function (group) {
            var groupTotal = 0;
            (group.items || []).forEach(function (item) {
                groupTotal += counts[item.id] || 0;
            });
            var groupSpan = this.groupCountMap[group.id];
            if (groupSpan) {
                groupSpan.textContent = '' + groupTotal;
            }
        }, this);

        if (this.poiTotalCountEl) {
            this.poiTotalCountEl.textContent = '总数 ' + total;
        }

        if (this.flatMode) {
            var typeCheckboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
            typeCheckboxes.forEach(function (checkbox) {
                var typeId = checkbox.value;
                var count = counts[typeId] || 0;
                var visible = visibleCounts[typeId] || 0;
                var countEl = checkbox.closest('.poi-type-card');
                if (countEl) {
                    var badge = countEl.querySelector('.type-count');
                    if (badge) {
                        if (visible > 0 && visible < count) {
                            badge.textContent = '' + visible + '/' + count;
                        } else {
                            badge.textContent = '' + count;
                        }
                    }
                    countEl.classList.toggle('is-visible', visible > 0);
                    countEl.classList.toggle('is-hidden', visible === 0);
                    countEl.classList.toggle('is-partial', visible > 0 && visible < count);
                }
                checkbox.indeterminate = visible > 0 && visible < count;
            });
            this.updateToggleAllPoiText();
            return;
        }

        var treeCheckboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
        treeCheckboxes.forEach(function (checkbox) {
            var typeId = checkbox.value;
            var count = counts[typeId] || 0;
            var visible = visibleCounts[typeId] || 0;
            checkbox.indeterminate = visible > 0 && visible < count;
            var card = checkbox.closest('.type-block');
            if (card) {
                card.classList.toggle('is-visible', visible > 0);
                card.classList.toggle('is-hidden', visible === 0);
                card.classList.remove('is-on', 'is-off', 'is-mixed');
                if (checkbox.indeterminate) {
                    card.classList.add('is-mixed');
                } else if (checkbox.checked) {
                    card.classList.add('is-on');
                } else {
                    card.classList.add('is-off');
                }
            }
        }, this);

        this.filterGroups.forEach(function (item) {
            this.updateToggleButtonText(item.group, item.button);
            var groupCard = document.querySelector('[data-expand-btn="' + item.groupId + '"]');
            if (!groupCard) return;
            var host = groupCard.closest('.poi-group-card');
            if (!host) return;
            var groupCount = this.groupCountMap[item.groupId];
            var countText = groupCount ? Number(groupCount.textContent || 0) : 0;
            host.classList.toggle('is-hidden', countText <= 0);
            host.classList.toggle('is-visible', countText > 0);
        }, this);
        this.updateToggleAllPoiText();
    };

    FilterPanel.prototype.computeVisibleCounts = function () {
        var counts = {};
        var pointsByType = this.markerManager.getPointsByType() || {};
        Object.keys(pointsByType).forEach(function (typeKey) {
            if (typeKey === 'center') return;
            var list = pointsByType[typeKey] || [];
            var visible = 0;
            list.forEach(function (pt) {
                if (this.markerManager.isPointEnabled(pt)) {
                    visible += 1;
                }
            }, this);
            counts[typeKey] = visible;
        }, this);
        return counts;
    };

    FilterPanel.prototype.updateToggleAllPoiText = function () {
        if (!this.toggleAllPoiBtn) return;
        var allTypeCheckboxes = document.querySelectorAll('#filtersContainer input[type="checkbox"].type-checkbox');
        if (!allTypeCheckboxes.length) {
            this.toggleAllPoiBtn.textContent = '全部显示';
            return;
        }

        var allChecked = true;
        allTypeCheckboxes.forEach(function (cb) {
            if (!cb.checked || cb.indeterminate) allChecked = false;
        });
        this.toggleAllPoiBtn.textContent = allChecked ? '全部隐藏' : '全部显示';
    };

    FilterPanel.prototype.focusPointInPanel = function (pid, autoCenter) {
        var targetPid = pid;
        if (!targetPid) return;
        var row = this.pointRowMap[targetPid];
        if (!row) {
            var point = this.markerManager.pointsByPid ? this.markerManager.pointsByPid[targetPid] : null;
            if (point && point.type && point.type !== 'center') {
                if (this.flatMode) {
                    this.setTypeExpanded(point.type, true);
                } else {
                    var gid = this.typeToGroupMap[point.type];
                    if (gid) {
                        this.setGroupExpanded(gid, true);
                    }
                    this.setTypeExpanded(point.type, true);
                }
                this.updateExpandAllButtonText();
                row = this.pointRowMap[targetPid];
            }
        }
        if (!row) return;
        if (this.flatMode) {
            var typeId = row.dataset.typeId;
            this.setTypeExpanded(typeId, true);
            this.updateExpandAllButtonText();
        } else {
            var groupId = row.dataset.groupId;
            var typeIdInTree = row.dataset.typeId;
            this.setGroupExpanded(groupId, true);
            this.setTypeExpanded(typeIdInTree, true);
            this.updateExpandAllButtonText();
        }

        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.markRowHighlight(row);

        if (autoCenter !== false) {
            this.markerManager.focusMarkerOnMap(targetPid, false);
        }
    };

    FilterPanel.prototype.markRowHighlight = function (rowEl) {
        if (!rowEl) return;
        rowEl.classList.add('highlight-row');
        setTimeout(function () {
            rowEl.classList.remove('highlight-row');
        }, 1500);
    };

    window.FilterPanel = FilterPanel;
})(window, window.MapUtils);
