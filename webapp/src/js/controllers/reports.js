var _ = require('underscore'),
  scrollLoader = require('../modules/scroll-loader'),
  lineageFactory = require('@medic/lineage');

angular
  .module('inboxControllers')
  .controller('ReportsCtrl', function(
    $log,
    $ngRedux,
    $scope,
    $state,
    $stateParams,
    $timeout,
    AddReadStatus,
    Changes,
    DB,
    Export,
    GlobalActions,
    LiveList,
    MarkRead,
    Modal,
    ReportViewModelGenerator,
    ReportsActions,
    Search,
    SearchFilters,
    Selectors,
    Tour
  ) {
    'use strict';
    'ngInject';

    const ctrl = this;
    const mapStateToTarget = function(state) {
      return {
        enketoEdited: Selectors.getEnketoEditedStatus(state),
        filters: Selectors.getFilters(state),
        selectMode: Selectors.getSelectMode(state),
        selectedReports: Selectors.getSelectedReports(state),
        selectedReportsDocs: Selectors.getSelectedReportsDocs(state),
        showContent: Selectors.getShowContent(state),
        unreadCount: Selectors.getUnreadCount(state)
      };
    };
    const mapDispatchToTarget = function(dispatch) {
      const globalActions = GlobalActions(dispatch);
      const reportsActions = ReportsActions(dispatch);
      return {
        addSelectedReport: reportsActions.addSelectedReport,
        clearFilters: globalActions.clearFilters,
        removeSelectedReport: reportsActions.removeSelectedReport,
        setFilters: globalActions.setFilters,
        setFirstSelectedReportDocProperty: reportsActions.setFirstSelectedReportDocProperty,
        setLastChangedDoc: globalActions.setLastChangedDoc,
        setLeftActionBar: globalActions.setLeftActionBar,
        setLoadingSubActionBar: globalActions.setLoadingSubActionBar,
        setRightActionBar: globalActions.setRightActionBar,
        setSelectedReports: reportsActions.setSelectedReports,
        updateUnreadCount: globalActions.updateUnreadCount
      };
    };
    const unsubscribe = $ngRedux.connect(mapStateToTarget, mapDispatchToTarget)(ctrl);

    var lineage = lineageFactory();

    // selected objects have the form
    //    { _id: 'abc', summary: { ... }, report: { ... }, expanded: false }
    // where the summary is the data required for the collapsed view,
    // report is the db doc, and expanded is whether to how the details
    // or just the summary in the content pane.
    ctrl.setSelectedReports([]);
    ctrl.appending = false;
    ctrl.error = false;
    ctrl.setFilters({
      search: $stateParams.query,
    });
    $scope.verifyingReport = false;

    var liveList = LiveList.reports;
    LiveList.$init($scope, 'reports', 'report-search');

    var updateLiveList = function(updated) {
      return AddReadStatus.reports(updated).then(function() {
        updated.forEach(function(report) {
          liveList.update(report);
        });
        $scope.hasReports = liveList.count() > 0;
        liveList.refresh();
        if ($state.params.id) {
          liveList.setSelected($state.params.id);
        }
        setActionBarData();
        return updated;
      });
    };

    var setSelected = function(model) {
      $scope.setSelected(model);
      if (ctrl.selectMode) {
        return;
      }
      var listModel = _.findWhere(liveList.getList(), { _id: model._id });
      if (listModel && !listModel.read) {
        ctrl.updateUnreadCount({ report: ctrl.unreadCount.report - 1 });
        listModel.read = true;
        LiveList.reports.update(listModel);
        LiveList['report-search'].update(listModel);
      }
      MarkRead([model.doc])
        .catch(function(err) {
          $log.error('Error marking read', err);
        });
    };

    var setTitle = function(model) {
      var formInternalId = model.formInternalId || model.form;
      var form = _.findWhere($scope.forms, { code: formInternalId });
      var name = (form && form.name) || (form && form.title) || model.form;
      $scope.setTitle(name);
    };

    var setRightActionBar = function() {
      const model = {};
      const doc =
        !ctrl.selectMode &&
        ctrl.selectedReportsDocs &&
        ctrl.selectedReportsDocs.length === 1 &&
        ctrl.selectedReportsDocs[0];
      if (!doc) {
        return ctrl.setRightActionBar(model);
      }
      model.verified = doc.verified;
      model.type = doc.content_type;
      model.verifyingReport = $scope.verifyingReport;
      if (!doc.contact || !doc.contact._id) {
        return ctrl.setRightActionBar(model);
      }

      DB()
        .get(doc.contact._id)
        .then(function(contact) {
          model.sendTo = contact;
          ctrl.setRightActionBar(model);
        })
        .catch(function(err) {
          ctrl.setRightActionBar(model);
          throw err;
        });
    };

    $scope.setSelected = function(model) {
      var refreshing = true;
      if (ctrl.selectMode) {
        var existing = _.findWhere(ctrl.selectedReports, { _id: model.doc._id });
        if (existing) {
          _.extend(existing, model);
        } else {
          model.expanded = false;
          ctrl.addSelectedReport(model);
        }
      } else {
        if (liveList.initialised()) {
          liveList.setSelected(model.doc && model.doc._id);
        }
        refreshing =
          model.doc &&
          ctrl.selectedReports.length &&
          ctrl.selectedReports[0]._id === model.doc._id;
        if (!refreshing) {
          $scope.verifyingReport = false;
        }

        model.expanded = true;
        ctrl.setSelectedReports([model]);
        setTitle(model);
      }
      setRightActionBar();
      $scope.settingSelected(refreshing);
    };

    var fetchFormattedReport = function(report) {
      var id = _.isString(report) ? report : report._id;
      return ReportViewModelGenerator(id);
    };

    $scope.refreshReportSilently = function(report) {
      return fetchFormattedReport(report)
        .then(function(model) {
          setSelected(model);
        })
        .catch(function(err) {
          $log.error('Error fetching formatted report', err);
        });
    };

    var removeSelectedReport = function(id) {
      ctrl.removeSelectedReport(id);
      var index = _.findIndex(ctrl.selectedReports, function(s) {
        return s._id === id;
      });
      if (index !== -1) {
        setRightActionBar();
      }
    };

    $scope.deselectReport = function(report) {
      const reportId = report._id || report;
      removeSelectedReport(reportId);
      $(`#reports-list li[data-record-id="${reportId}"] input[type="checkbox"]`).prop('checked', false);
      $scope.settingSelected(true);
    };

    $scope.selectReport = function(report) {
      if (!report) {
        $scope.clearSelected();
        return;
      }
      $scope.setLoadingContent(report);
      fetchFormattedReport(report)
        .then(function(model) {
          if (model) {
            $timeout(function() {
              setSelected(model);
              initScroll();
            });
          }
        })
        .catch(function(err) {
          $scope.clearSelected();
          $log.error('Error selecting report', err);
        });
    };

    var query = function(opts) {
      const options = _.extend({ limit: 50, hydrateContactNames: true }, opts);
      if (!options.silent) {
        ctrl.error = false;
        ctrl.errorSyntax = false;
        ctrl.loading = true;
        if (ctrl.selectedReports.length && $scope.isMobile()) {
          $scope.selectReport();
        }
      }
      if (options.skip) {
        ctrl.appending = true;
        options.skip = liveList.count();
      } else if (!options.silent) {
        liveList.set([]);
      }

      Search('reports', ctrl.filters, options)
        .then(updateLiveList)
        .then(function(data) {
          $scope.moreItems = liveList.moreItems = data.length >= options.limit;
          ctrl.loading = false;
          ctrl.appending = false;
          ctrl.error = false;
          ctrl.errorSyntax = false;
          if (
            !$state.params.id &&
            !$scope.isMobile() &&
            !ctrl.selectedReports &&
            !ctrl.selectMode &&
            $state.is('reports.detail')
          ) {
            $timeout(function() {
              var id = $('.inbox-items li')
                .first()
                .attr('data-record-id');
              $state.go('reports.detail', { id: id }, { location: 'replace' });
            });
          }
          syncCheckboxes();
          initScroll();
        })
        .catch(function(err) {
          ctrl.error = true;
          ctrl.loading = false;
          if (
            ctrl.filters.search &&
            err.reason &&
            err.reason.toLowerCase().indexOf('bad query syntax') !== -1
          ) {
            // invalid freetext filter query
            ctrl.errorSyntax = true;
          }
          $log.error('Error loading messages', err);
        });
    };

    ctrl.search = function() {
      // clears report selection for any text search or filter selection
      // does not clear selection when someone is editing a form
      if((ctrl.filters.search || Object.keys(ctrl.filters).length > 1) && !ctrl.enketoEdited) {
        $state.go('reports.detail', { id: null }, { notify: false });
        clearSelection();
      }
      if ($scope.isMobile() && ctrl.showContent) {
        // leave content shown
        return;
      }
      ctrl.loading = true;
      if (
        ctrl.filters.search ||
        (ctrl.filters.forms &&
          ctrl.filters.forms.selected &&
          ctrl.filters.forms.selected.length) ||
        (ctrl.filters.facilities &&
          ctrl.filters.facilities.selected &&
          ctrl.filters.facilities.selected.length) ||
        (ctrl.filters.date &&
          (ctrl.filters.date.to || ctrl.filters.date.from)) ||
        (ctrl.filters.valid === true || ctrl.filters.valid === false) ||
        (ctrl.filters.verified && ctrl.filters.verified.length)
      ) {
        $scope.filtered = true;
        liveList = LiveList['report-search'];
      } else {
        $scope.filtered = false;
        liveList = LiveList.reports;
      }
      query();
    };

    $scope.$on('ToggleVerifyingReport', function() {
      $scope.verifyingReport = !$scope.verifyingReport;
      setRightActionBar();
    });

    const clearSelection = () => {
      ctrl.setSelectedReports([]);
      LiveList.reports.clearSelected();
      LiveList['report-search'].clearSelected();
      $('#reports-list input[type="checkbox"]').prop('checked', false);
      $scope.verifyingReport = false;
    };

    $scope.$on('ClearSelected', function() {
      clearSelection();
    });

    $scope.$on('EditReport', function() {
      Modal({
        templateUrl: 'templates/modals/edit_report.html',
        controller: 'EditReportCtrl',
        model: { report: ctrl.selectedReports[0].doc },
      });
    });

    $scope.$on('VerifyReport', function(e, valid) {
      if (ctrl.selectedReports[0].doc.form) {
        ctrl.setLoadingSubActionBar(true);

        if (ctrl.selectedReports[0].doc.contact) {
          var minifiedContact = lineage.minifyLineage(ctrl.selectedReports[0].doc.contact);
          ctrl.setFirstSelectedReportDocProperty({ contact: minifiedContact });
        }

        var verified = ctrl.selectedReports[0].doc.verified === valid ? undefined : valid;
        ctrl.setFirstSelectedReportDocProperty({ verified: verified });
        ctrl.setLastChangedDoc(ctrl.selectedReports[0].doc);

        DB()
          .get(ctrl.selectedReports[0].doc._id)
          .then(function(doc) {
            ctrl.setFirstSelectedReportDocProperty({ _rev: doc._rev });
            return DB().post(ctrl.selectedReports[0].doc);
          })
          .catch(function(err) {
            $log.error('Error verifying message', err);
          })
          .finally(() => {
            $scope.$broadcast('VerifiedReport', valid);

            ctrl.setLoadingSubActionBar(false);
          });
      }
    });

    var initScroll = function() {
      scrollLoader.init(function() {
        if (!ctrl.loading && $scope.moreItems) {
          query({ skip: true });
        }
      });
    };

    if (!$state.params.id) {
      $scope.selectReport();
    }

    if ($stateParams.tour) {
      Tour.start($stateParams.tour);
    }

    $scope.edit = function(report, group) {
      Modal({
        templateUrl: 'templates/modals/edit_message_group.html',
        controller: 'EditMessageGroupCtrl',
        model: {
          report: report,
          group: angular.copy(group),
        },
      });
    };

    ctrl.resetFilterModel = function() {
      if (ctrl.selectMode && ctrl.selectedReports && ctrl.selectedReports.length) {
        // can't filter when in select mode
        return;
      }
      ctrl.clearFilters();
      SearchFilters.reset();
      ctrl.search();
    };

    if ($scope.forms) {
      // if forms are already loaded
      ctrl.search();
    } else {
      // otherwise wait for loading to complete
      ctrl.loading = true;
      $scope.$on('formLoadingComplete', function() {
        ctrl.search();
        var doc =
          ctrl.selectedReports && ctrl.selectedReports[0] && ctrl.selectedReports[0].doc;
        if (doc) {
          setTitle(doc);
        }
      });
    }

    $('.inbox').on('click', '#reports-list .content-row', function(e) {
      if (ctrl.selectMode) {
        e.preventDefault();
        e.stopPropagation();
        var target = $(e.target).closest('li[data-record-id]');
        var reportId = target.attr('data-record-id');
        var checkbox = target.find('input[type="checkbox"]');
        var alreadySelected = _.findWhere(ctrl.selectedReports, { _id: reportId });
        // timeout so if the user clicked the checkbox it has time to
        // register before we set it to the correct value.
        $timeout(function() {
          checkbox.prop('checked', !alreadySelected);
          if (!alreadySelected) {
            $scope.selectReport(reportId);
          } else {
            removeSelectedReport(reportId);
          }
        });
      }
    });

    var syncCheckboxes = function() {
      $('#reports-list li').each(function() {
        var id = $(this).attr('data-record-id');
        var found = _.findWhere(ctrl.selectedReports, { _id: id });
        $(this)
          .find('input[type="checkbox"]')
          .prop('checked', found);
      });
    };

    $scope.$on('SelectAll', function() {
      $scope.setLoadingContent(true);
      Search('reports', ctrl.filters, { limit: 500, hydrateContactNames: true })
        .then(function(summaries) {
          var selected = summaries.map(function(summary) {
            return {
              _id: summary._id,
              summary: summary,
              expanded: false,
              lineage: summary.lineage,
              contact: summary.contact,
            };
          });
          ctrl.setSelectedReports(selected);
          $scope.settingSelected(true);
          setRightActionBar();
          $('#reports-list input[type="checkbox"]').prop('checked', true);
        })
        .catch(function(err) {
          $log.error('Error selecting all', err);
        });
    });

    var deselectAll = function() {
      ctrl.setSelectedReports([]);
      setRightActionBar();
      $('#reports-list input[type="checkbox"]').prop('checked', false);
    };

    var setActionBarData = function() {
      ctrl.setLeftActionBar({
        hasResults: $scope.hasReports,
        exportFn: function(e) {
          var exportFilters = _.extendOwn({}, ctrl.filters);
          ['forms', 'facilities'].forEach(function(type) {
            if (exportFilters[type]) {
              delete exportFilters[type].options;
            }
          });
          var $link = $(e.target).closest('a');
          $link.addClass('mm-icon-disabled');
          $timeout(function() {
            $link.removeClass('mm-icon-disabled');
          }, 2000);

          Export('reports', exportFilters, { humanReadable: true });
        },
      });
    };

    setActionBarData();

    $scope.$on('DeselectAll', deselectAll);

    var changeListener = Changes({
      key: 'reports-list',
      callback: function(change) {
        if (change.deleted) {
          liveList.remove(change.id);
          $scope.hasReports = liveList.count() > 0;
          setActionBarData();
        } else {
          query({ silent: true, limit: Math.max(50, liveList.count()) });
        }
      },
      filter: function(change) {
        return change.doc && change.doc.form || liveList.contains(change.id);
      },
    });

    $scope.$on('$destroy', function() {
      unsubscribe();
      changeListener.unsubscribe();
      if (!$state.includes('reports')) {
        SearchFilters.destroy();
        LiveList.$reset('reports', 'report-search');
        $('.inbox').off('click', '#reports-list .content-row');
      }
    });
  });
