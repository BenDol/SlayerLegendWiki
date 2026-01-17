/**
 * Familiar Serialization/Deserialization Utilities
 *
 * Handles conversion between:
 * - Serialized format (familiarId only) - for storage/API
 * - Deserialized format (full familiar object) - for display
 *
 * Usage:
 * - serialize: Before saving to API/cache
 * - deserialize: After loading from API/cache
 */

import { createLogger } from './logger.js';
import { findPrimeFamiliar } from './familiarHelpers.js';

const logger = createLogger('FamiliarSerialization');

/**
 * Serialize a familiar configuration (for my-familiars collection)
 * Converts familiar object to just ID for storage
 *
 * @param {Object} familiarConfig - Familiar configuration with full familiar object
 * @returns {Object} Serialized familiar with only familiarId
 */
export const serializeFamiliar = (familiarConfig) => {
  if (!familiarConfig) return null;

  return {
    familiarId: familiarConfig.familiarId !== undefined ? familiarConfig.familiarId : (familiarConfig.familiar?.id || null),
    starLevel: familiarConfig.starLevel || 0
  };
};

/**
 * Deserialize a familiar configuration (for my-familiars collection)
 * Converts familiarId to full familiar object using familiars database
 *
 * @param {Object} serializedFamiliar - Serialized familiar with familiarId
 * @param {Array} familiarsData - Full familiars database
 * @param {string|number} recordId - Optional record ID to preserve
 * @returns {Object} Deserialized familiar with full familiar object
 */
export const deserializeFamiliar = (serializedFamiliar, familiarsData, recordId = null) => {
  if (!serializedFamiliar) return null;

  // Check if already deserialized (has familiar object with name)
  if (serializedFamiliar.familiar && typeof serializedFamiliar.familiar === 'object' && serializedFamiliar.familiar.name) {
    return {
      ...serializedFamiliar,
      id: recordId || serializedFamiliar.id // Preserve record ID
    };
  }

  // Deserialize from ID
  const familiar = familiarsData.find(f => f.id === serializedFamiliar.familiarId);
  return {
    id: recordId || serializedFamiliar.id, // Preserve record ID for edit/delete
    familiar: familiar || null,
    familiarId: serializedFamiliar.familiarId,
    starLevel: serializedFamiliar.starLevel || 0,
    createdAt: serializedFamiliar.createdAt,
    updatedAt: serializedFamiliar.updatedAt
  };
};

/**
 * Serialize a familiar slot (handles both collection and base types)
 *
 * @param {Object} slot - Familiar slot with full data
 * @returns {Object} Serialized slot
 */
export const serializeSlot = (slot) => {
  if (!slot) {
    return {
      type: "base",
      familiarId: null,
      category: null,
      starLevel: 0
    };
  }

  // If slot has myFamiliarId, it's a collection familiar (reference)
  // Check this BEFORE checking familiar, because deleted collection familiars have familiar: null
  if (slot.myFamiliarId) {
    return {
      type: "collection",
      myFamiliarId: slot.myFamiliarId,
      category: slot.category
      // Note: starLevel is NOT saved - it always comes from the collection familiar record
    };
  }

  // Empty slot (no familiar and no collection reference)
  if (!slot.familiar) {
    return {
      type: "base",
      familiarId: null,
      category: slot.category || null,
      starLevel: 0
    };
  }

  // Otherwise, it's a base familiar (snapshot)
  return {
    type: "base",
    familiarId: slot.familiar?.id || null,
    category: slot.category,
    starLevel: slot.starLevel || 0
  };
};

/**
 * Deserialize a familiar slot in a build
 * Handles empty slots (familiar: null), serialized slots, and both collection and base types
 *
 * @param {Object} slot - Slot with familiarId or myFamiliarId
 * @param {Array} familiarsData - Full familiars database
 * @param {Array} myFamiliars - User's familiar collection (optional)
 * @returns {Object} Deserialized slot with full familiar object or null
 */
export const deserializeSlot = (slot, familiarsData, myFamiliars = []) => {
  if (!slot) return null;

  // COLLECTION FAMILIAR (Reference)
  if (slot.type === "collection" && slot.myFamiliarId) {
    const myFamiliar = myFamiliars.find(f => f.id === slot.myFamiliarId);

    if (!myFamiliar) {
      // Familiar not found in collection (deleted)
      return {
        type: "collection",
        myFamiliarId: slot.myFamiliarId,
        category: slot.category,
        familiar: null,
        missing: true,
        starLevel: 0
      };
    }

    // Resolve the base familiar data
    const baseFamiliar = familiarsData.find(f => f.id === myFamiliar.familiarId);

    return {
      type: "collection",
      myFamiliarId: myFamiliar.id,
      category: slot.category,
      familiar: baseFamiliar || null,
      starLevel: myFamiliar.starLevel  // Always use collection familiar's star level
    };
  }

  // BASE FAMILIAR (Snapshot) - already deserialized
  if (slot.familiar && typeof slot.familiar === 'object' && slot.familiar.name) {
    // Auto-upgrade to collection familiar if it exists in myFamiliars
    if ((slot.type === "base" || !slot.type) && myFamiliars && myFamiliars.length > 0) {
      const collectionFamiliar = myFamiliars.find(mf => mf.familiarId === slot.familiar.id);
      if (collectionFamiliar) {
        return {
          type: "collection",
          myFamiliarId: collectionFamiliar.id,
          category: slot.category,
          familiar: slot.familiar,
          starLevel: collectionFamiliar.starLevel  // Always use collection familiar's star level
        };
      }
    }

    return {
      type: slot.type || "base",
      category: slot.category,
      familiar: slot.familiar,
      starLevel: slot.starLevel || 0
    };
  }

  // BASE FAMILIAR (Snapshot) - needs deserialization
  if (slot.type === "base" || slot.familiarId !== undefined) {
    const familiar = familiarsData.find(f => f.id === slot.familiarId);

    // Auto-upgrade to collection familiar if it exists in myFamiliars
    if (myFamiliars && myFamiliars.length > 0) {
      const collectionFamiliar = myFamiliars.find(mf => mf.familiarId === slot.familiarId);
      if (collectionFamiliar) {
        return {
          type: "collection",
          myFamiliarId: collectionFamiliar.id,
          category: slot.category,
          familiar: familiar || null,
          starLevel: collectionFamiliar.starLevel  // Always use collection familiar's star level
        };
      }
    }

    return {
      type: "base",
      category: slot.category,
      familiar: familiar || null,
      starLevel: slot.starLevel || 0
    };
  }

  // Empty slot
  return {
    type: "base",
    category: slot.category || null,
    familiar: null,
    starLevel: 0
  };
};

/**
 * Deserialize a familiar build
 * Converts all slots with familiarId or myFamiliarId to full familiar objects
 * Regenerates Prime Familiar data if slots are complete
 *
 * IMPORTANT: Ensures slot order is always: Element (0), Battle (1), Weapon (2)
 *
 * @param {Object} build - Build with serialized slots
 * @param {Array} familiarsData - Full familiars database
 * @param {Array} myFamiliars - User's familiar collection (optional)
 * @param {Array} primeFamiliarsData - Prime familiar definitions (optional, for regeneration)
 * @returns {Object} Deserialized build with full familiar objects
 */
export const deserializeBuild = (build, familiarsData, myFamiliars = [], primeFamiliarsData = []) => {
  if (!build) return null;

  logger.debug('Deserializing build', {
    hasBuild: !!build,
    slotsCount: build.slots?.length,
    familiarsDataCount: familiarsData?.length,
    myFamiliarsCount: myFamiliars?.length,
    primeFamiliarsDataCount: primeFamiliarsData?.length
  });

  let slots = build.slots?.map(slot => deserializeSlot(slot, familiarsData, myFamiliars)) || [];

  // Ensure slots are in correct order: element (0), attribute (1), weapon (2)
  // If slots are missing or out of order, reconstruct with correct order
  if (slots.length !== 3) {
    logger.warn('Invalid slot count, creating empty slots', { slotsCount: slots.length });
    slots = [
      createEmptySlot("element"),
      createEmptySlot("attribute"),
      createEmptySlot("weapon")
    ];
  } else {
    // Ensure categories are in correct positions (defensive programming)
    const expectedCategories = ["element", "attribute", "weapon"];
    slots = slots.map((slot, index) => ({
      ...slot,
      category: expectedCategories[index] // Enforce correct category for each position
    }));
  }

  // Regenerate Prime Familiar if all slots are filled
  let primeFamiliar = null;
  const allSlotsFilled = slots.every(slot => slot.familiar !== null);
  if (allSlotsFilled) {
    const elementFamiliarId = slots[0]?.familiar?.id;
    const attributeFamiliarId = slots[1]?.familiar?.id;
    const weaponFamiliarId = slots[2]?.familiar?.id;

    if (elementFamiliarId && attributeFamiliarId && weaponFamiliarId) {
      primeFamiliar = findPrimeFamiliar(
        elementFamiliarId,
        attributeFamiliarId,
        weaponFamiliarId,
        primeFamiliarsData,
        familiarsData
      );
      logger.debug('Regenerated Prime Familiar', {
        primeFamiliarId: primeFamiliar?.id,
        primeFamiliarName: primeFamiliar?.name,
        isCustom: primeFamiliar?.isCustom
      });
    }
  }

  const deserialized = {
    ...build,
    slots,
    primeFamiliar
  };

  logger.debug('Deserialized build result', {
    slotsCount: deserialized.slots?.length,
    categories: deserialized.slots.map(s => s.category),
    hasPrimeFamiliar: !!deserialized.primeFamiliar,
    primeFamiliarName: deserialized.primeFamiliar?.name
  });

  return deserialized;
};

/**
 * Serialize a familiar build
 * Converts all slots with full familiar objects to appropriate format (collection or base)
 * Note: Prime Familiar is NOT serialized - it's regenerated on deserialization based on slot familiars
 *
 * @param {Object} build - Build with full familiar objects
 * @returns {Object} Serialized build with only necessary data
 */
export const serializeBuild = (build) => {
  if (!build) return null;

  const serialized = {
    ...build,
    slots: build.slots?.map(slot => serializeSlot(slot)) || []
  };

  // Remove prime familiar - it will be regenerated on deserialization
  delete serialized.primeFamiliar;

  return serialized;
};

/**
 * Serialize a familiar slot for sharing (always use base format, never collection)
 * Recipients won't have access to collection IDs, so convert everything to base snapshots
 *
 * @param {Object} slot - Familiar slot with full data
 * @returns {Object} Serialized slot in base format
 */
export const serializeSlotForSharing = (slot) => {
  if (!slot || !slot.familiar) {
    return {
      type: "base",
      familiarId: null,
      category: slot?.category || null,
      starLevel: 0
    };
  }

  // Always convert to base format (including collection familiars)
  return {
    type: "base",
    familiarId: slot.familiar?.id || null,
    category: slot.category,
    starLevel: slot.starLevel || 0
  };
};

/**
 * Serialize a familiar build for sharing
 * Converts all slots to base format so recipients can see them without collection access
 *
 * @param {Object} build - Build with full familiar objects
 * @returns {Object} Serialized build in base format
 */
export const serializeBuildForSharing = (build) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => serializeSlotForSharing(slot)) || [],
    // Include full Prime Familiar data for sharing
    primeFamiliar: build.primeFamiliar || null
  };
};

/**
 * Check if a build has any missing familiars (deleted collection references)
 *
 * @param {Object} build - Build to check
 * @returns {boolean} True if build has missing familiars
 */
export const hasMissingFamiliars = (build) => {
  if (!build || !build.slots) return false;
  return build.slots.some(slot => slot?.missing === true);
};

/**
 * Get list of missing familiar IDs in a build
 *
 * @param {Object} build - Build to check
 * @returns {Array} Array of missing myFamiliarId values
 */
export const getMissingFamiliarIds = (build) => {
  if (!build || !build.slots) return [];
  return build.slots
    .filter(slot => slot?.missing === true && slot.myFamiliarId)
    .map(slot => slot.myFamiliarId);
};

/**
 * Create a default empty familiar slot
 *
 * @param {string} category - Category for this slot (element, attribute, weapon)
 * @returns {Object} Empty slot object
 */
export const createEmptySlot = (category) => ({
  type: "base",
  category,
  familiar: null,
  starLevel: 0
});

/**
 * Create a default empty familiar build
 *
 * IMPORTANT: Slot order is fixed and must not be changed:
 * - Slot 0: Element (attribute)
 * - Slot 1: Battle (attribute)
 * - Slot 2: Weapon (ALWAYS LAST)
 *
 * @returns {Object} Empty build with 3 slots
 */
export const createEmptyBuild = () => {
  const emptyBuild = {
    slots: [
      createEmptySlot("element"),    // Slot 0: Element
      createEmptySlot("attribute"),  // Slot 1: Battle
      createEmptySlot("weapon")      // Slot 2: Weapon (ALWAYS LAST)
    ],
    primeFamiliar: null
  };

  logger.debug('createEmptyBuild called', {
    slotsCount: emptyBuild.slots.length,
    build: emptyBuild
  });

  return emptyBuild;
};

logger.debug('Familiar serialization utilities loaded');
