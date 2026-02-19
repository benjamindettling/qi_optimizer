import { UnlockRegionModal } from "../../components/modals/UnlockRegionModal";
import { ChooseGoodModal } from "../../components/modals/ChooseGoodModal";
import { GoodsPurchaseModal } from "../../components/modals/GoodsPurchaseModal";
import { UnitsPurchaseModal } from "../../components/modals/UnitsPurchaseModal";
import { FastBuyModal } from "../../components/modals/FastBuyModal";
import { HarvestModal } from "../../components/modals/HarvestModal";
import { SmartHarvestModal } from "../../components/modals/SmartHarvestModal";
import { SmartInvestModal } from "../../components/modals/SmartInvestModal";
import { HelpModal } from "../../components/modals/HelpModal";
import { AccountModal } from "../../components/modals/AccountModal";
import { EditGoodModal } from "../../components/modals/EditGoodModal";
import { EditUnitModal } from "../../components/modals/EditUnitModal";
import { WorstRemovalModal } from "../../components/modals/WorstRemovalModal";
import { ExportSavesModal } from "../../components/modals/ExportSavesModal";
import { ImportSavesModal } from "../../components/modals/ImportSavesModal";
import { LoadSavesModal } from "../../components/modals/LoadSavesModal";
import { PastEditWarningModal } from "../../components/modals/PastEditWarningModal";
import { EditResourceModal } from "../../components/modals/EditResourceModal";
import "../../components/modals/modals.css";
import "../../components/modals/LoadSavesModal.css";

// Centralizes modal rendering to keep the root component lean.
export function AppModals({
  controller,
  accountModalOpen,
  accountInitialTab,
  setAccountModalOpen,
  viewMode,
  setViewMode,
  useShortNames,
  setUseShortNames,
  toolbarPosition,
  setToolbarPosition,
  boardScale,
  setBoardScale,
  saveAccountToCloud,
  canCloudSave,
  cloudProfile,
}) {
  const {
    unlockChoice,
    setUnlockChoice,
    unlockGoodSelect,
    setUnlockGoodSelect,
    resources,
    config,
    handleUnlockRegion,
    layout,
    libraryMap,
    harvestModal,
    confirmHarvest,
    cancelHarvest,
    smartHarvestModal,
    confirmSmartHarvest,
    smartInvestModal,
    applySmartInvestResult,
    continueSmartInvest,
    closeSmartInvestModal,
    goodsModal,
    setGoodsModal,
    handleGoodsPurchase,
    unitModal,
    setUnitModal,
    handleUnitPurchase,
    editUnitModal,
    applyUnitEdit,
    cancelEditUnit,
    editGoodModal,
    applyGoodEdit,
    cancelEditGood,
    editResourceModal,
    applyResourceEdit,
    cancelEditResource,
    fastBuyModal,
    handleFastBuy,
    setFastBuyModal,
    setFastBuyTarget,
    helpModal,
    setHelpModal,
    updateConfig,
    applyStartBonusToCheckpoints,
    exportModal,
    importModal,
    loadSavesModal,
    setExportModal,
    setImportModal,
    setLoadSavesModal,
    visibleSaves,
    saves,
    loadName,
    handleExportSelected,
    handleExportSavefile,
    handleRenameSavefile,
    handleDeleteSavefile,
    handleImportSelected,
    handleUpdateSaveConfig,
    handleLoadState,
    worstModal,
    setWorstModal,
    pastEditModal,
    handleCopyAndEnableEdit,
    handleEnableEditFromPast,
    closePastEditModal,
    hasUnsavedChanges,
  } = controller;

  return (
    <>
      <UnlockRegionModal
        unlockChoice={unlockChoice}
        onChooseGoods={(idx, goodsCost) => {
          setUnlockGoodSelect({ idx, goodsCost });
          setUnlockChoice(null);
        }}
        onUnlockWithShards={(idx) => handleUnlockRegion(idx, "shards")}
        onCancel={() => setUnlockChoice(null)}
        shards={resources?.shards ?? 0}
        allowNegativeShards={!!config?.allowNegativeShards}
      />

      <ChooseGoodModal
        unlockGoodSelect={unlockGoodSelect}
        goods={resources.goods}
        layout={layout}
        libraryMap={libraryMap}
        onUnlockWithGood={(idx, goodKey) =>
          handleUnlockRegion(idx, "goods", goodKey)
        }
        onCancel={() => setUnlockGoodSelect(null)}
      />

      <HarvestModal
        harvestModal={harvestModal}
        onConfirm={confirmHarvest}
        onCancel={cancelHarvest}
      />
      <SmartHarvestModal
        smartHarvestModal={smartHarvestModal}
        onConfirm={confirmSmartHarvest}
      />
      <SmartInvestModal
        smartInvestModal={smartInvestModal}
        onClose={closeSmartInvestModal}
        onApplyResult={applySmartInvestResult}
        onContinue={continueSmartInvest}
      />

      <GoodsPurchaseModal
        goodsModal={goodsModal}
        onPurchase={handleGoodsPurchase}
        onClose={() => setGoodsModal(null)}
      />
      <UnitsPurchaseModal
        unitModal={unitModal}
        onPurchase={handleUnitPurchase}
        onClose={() => setUnitModal(null)}
      />
      <EditUnitModal
        modal={editUnitModal}
        onSave={applyUnitEdit}
        onClose={cancelEditUnit}
      />
      <EditGoodModal
        modal={editGoodModal}
        onSave={(val) => applyGoodEdit(val, false)}
        onSaveAll={(val) => applyGoodEdit(val, true)}
        onClose={cancelEditGood}
      />
      <EditResourceModal
        modal={editResourceModal}
        onSave={applyResourceEdit}
        onClose={cancelEditResource}
      />

      <FastBuyModal
        fastBuyModal={fastBuyModal}
        onFastBuy={handleFastBuy}
        onCancel={() => {
          setFastBuyModal(null);
          setFastBuyTarget(null);
        }}
      />
      <HelpModal open={!!helpModal} onClose={() => setHelpModal(false)} />
      <AccountModal
        open={!!accountModalOpen}
        initialTab={accountInitialTab}
        onClose={() => setAccountModalOpen(false)}
        config={config}
        onSave={updateConfig}
        onApplyStartBonus={applyStartBonusToCheckpoints}
        viewMode={viewMode}
        setViewMode={setViewMode}
        useShortNames={useShortNames}
        setUseShortNames={setUseShortNames}
        toolbarPosition={toolbarPosition}
        setToolbarPosition={setToolbarPosition}
        boardScale={boardScale}
        setBoardScale={setBoardScale}
        saveAccountToCloud={saveAccountToCloud}
        canCloudSave={canCloudSave}
        cloudProfile={cloudProfile}
      />
      <ExportSavesModal
        open={!!exportModal}
        saves={visibleSaves}
        onClose={() => setExportModal(false)}
        onExport={handleExportSelected}
      />
      <ImportSavesModal
        open={!!importModal}
        onClose={() => setImportModal(false)}
        onImport={handleImportSelected}
      />
      <LoadSavesModal
        open={!!loadSavesModal}
        saves={saves}
        loadName={loadName}
        onClose={() => setLoadSavesModal(false)}
        onLoad={handleLoadState}
        onRename={handleRenameSavefile}
        onDelete={handleDeleteSavefile}
        onExport={handleExportSavefile}
        onImport={handleImportSelected}
        onSaveConfig={handleUpdateSaveConfig}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      <WorstRemovalModal
        open={!!worstModal}
        data={worstModal}
        onClose={() => setWorstModal(null)}
      />
      <PastEditWarningModal
        open={pastEditModal}
        onCopyAndContinue={handleCopyAndEnableEdit}
        onContinue={handleEnableEditFromPast}
        onCancel={closePastEditModal}
        currentName={loadName}
      />
    </>
  );
}
