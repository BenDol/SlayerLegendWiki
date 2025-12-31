/**
 * Picker Handlers - Game-specific logic for inserting picker content
 *
 * Each handler receives:
 * - data: The data object from the picker's onSelect callback
 * - editorApi: The editor API with insertAtCursor method
 */

// Handle skill selection from picker
export const handleSkillSelect = (data, editorApi) => {
  const { skill, skillList, mode, alignment } = data;

  // Handle multiple skills (multiselect mode)
  if (skillList && skillList.length > 0) {
    const skillSyntaxes = skillList.map(sk => `{{skill:${sk.name}:${mode}}}`);
    let combinedSyntax = skillSyntaxes.join('\n\n');

    // Apply alignment wrapper if needed
    if (alignment && alignment !== 'none') {
      let style;
      if (alignment === 'center') {
        style = 'display: flex; justify-content: center;';
      } else if (alignment === 'left') {
        style = 'display: flex; justify-content: flex-start;';
      } else if (alignment === 'right') {
        style = 'display: flex; justify-content: flex-end;';
      }
      combinedSyntax = `<div style="${style}">\n\n${combinedSyntax}\n\n</div>`;
    }

    editorApi.insertAtCursor(`\n\n${combinedSyntax}  \n\n`);
    return;
  }

  // Handle single skill (original behavior)
  if (!skill) return;

  // Insert skill syntax into content
  // Format: {{skill:Fire Slash:detailed}} or {{skill:1:compact}}
  let skillSyntax = `{{skill:${skill.name}:${mode}}}`;

  // Apply alignment wrapper if needed (block-level)
  if (alignment && alignment !== 'none') {
    let style;
    if (alignment === 'center') {
      style = 'display: flex; justify-content: center;';
    } else if (alignment === 'left') {
      style = 'display: flex; justify-content: flex-start;';
    } else if (alignment === 'right') {
      style = 'display: flex; justify-content: flex-end;';
    }
    skillSyntax = `<div style="${style}">\n\n${skillSyntax}\n\n</div>`;
    // Block-level with alignment: add newlines for proper spacing
    editorApi.insertAtCursor(`\n\n${skillSyntax}  \n\n`);
  } else {
    // Inline (no alignment): insert without newlines at cursor position
    editorApi.insertAtCursor(skillSyntax);
  }
};

// Handle equipment selection from picker
export const handleEquipmentSelect = (data, editorApi) => {
  const { equipment, equipmentList, mode, alignment } = data;

  // Handle multiple equipment (multiselect mode)
  if (equipmentList && equipmentList.length > 0) {
    const equipmentSyntaxes = equipmentList.map(equip => `{{equipment:${equip.name}:${mode}}}`);
    let combinedSyntax = equipmentSyntaxes.join('\n\n');

    // Apply alignment wrapper if needed
    if (alignment && alignment !== 'none') {
      let style;
      if (alignment === 'center') {
        style = 'display: flex; justify-content: center;';
      } else if (alignment === 'left') {
        style = 'display: flex; justify-content: flex-start;';
      } else if (alignment === 'right') {
        style = 'display: flex; justify-content: flex-end;';
      }
      combinedSyntax = `<div style="${style}">\n\n${combinedSyntax}\n\n</div>`;
    }

    editorApi.insertAtCursor(`\n\n${combinedSyntax}  \n\n`);
    return;
  }

  // Handle single equipment (original behavior)
  if (!equipment) return;

  // Insert equipment syntax into content
  // Format: {{equipment:Innocence:detailed}} or {{equipment:1:compact}}
  let equipmentSyntax = `{{equipment:${equipment.name}:${mode}}}`;

  // Apply alignment wrapper if needed (block-level)
  if (alignment && alignment !== 'none') {
    let style;
    if (alignment === 'center') {
      style = 'display: flex; justify-content: center;';
    } else if (alignment === 'left') {
      style = 'display: flex; justify-content: flex-start;';
    } else if (alignment === 'right') {
      style = 'display: flex; justify-content: flex-end;';
    }
    equipmentSyntax = `<div style="${style}">\n\n${equipmentSyntax}\n\n</div>`;
    // Block-level with alignment: add newlines for proper spacing
    editorApi.insertAtCursor(`\n\n${equipmentSyntax}  \n\n`);
  } else {
    // Inline (no alignment): insert without newlines at cursor position
    editorApi.insertAtCursor(equipmentSyntax);
  }
};

// Handle spirit selection from picker
export const handleSpiritSelect = (data, editorApi) => {
  const { spirit, spiritList, mode, alignment, level, inline = true } = data;

  // Handle multiple spirits (multiselect mode)
  if (spiritList && spiritList.length > 0) {
    const displayType = inline ? 'inline' : 'block';
    const spiritSyntaxes = spiritList.map(sp => `{{spirit:${sp.name}:${mode}:${level}:${displayType}}}`);
    let combinedSyntax = spiritSyntaxes.join('\n\n');

    // Apply alignment wrapper if needed
    if (alignment && alignment !== 'none') {
      let style;
      if (alignment === 'center') {
        style = 'display: flex; justify-content: center;';
      } else if (alignment === 'left') {
        style = 'display: flex; justify-content: flex-start;';
      } else if (alignment === 'right') {
        style = 'display: flex; justify-content: flex-end;';
      }
      combinedSyntax = `<div style="${style}">\n\n${combinedSyntax}\n\n</div>`;
    }

    editorApi.insertAtCursor(`\n\n${combinedSyntax}  \n\n`);
    return;
  }

  // Handle single spirit (original behavior)
  if (!spirit) return;

  // Insert spirit syntax into content
  // Format: {{spirit:Loar:detailed:4:inline}} or {{spirit:Loar:compact:4:block}}
  const displayType = inline ? 'inline' : 'block';
  let spiritSyntax = `{{spirit:${spirit.name}:${mode}:${level}:${displayType}}}`;

  // Apply alignment wrapper if needed (block-level)
  if (alignment && alignment !== 'none') {
    let style;
    if (alignment === 'center') {
      style = 'display: flex; justify-content: center;';
    } else if (alignment === 'left') {
      style = 'display: flex; justify-content: flex-start;';
    } else if (alignment === 'right') {
      style = 'display: flex; justify-content: flex-end;';
    }
    spiritSyntax = `<div style="${style}">\n\n${spiritSyntax}\n\n</div>`;
    // Block-level with alignment: add newlines for proper spacing
    editorApi.insertAtCursor(`\n\n${spiritSyntax}  \n\n`);
  } else {
    // Inline (no alignment): insert without newlines at cursor position
    editorApi.insertAtCursor(spiritSyntax);
  }
};

// Handle battle loadout selection from picker
export const handleBattleLoadoutSelect = (data, editorApi) => {
  const { syntax } = data;

  // Insert battle loadout syntax into content
  // Format: {{battle-loadout:userId:loadoutId:mode}}
  editorApi.insertAtCursor(`\n\n${syntax}  \n\n`);
};

// Handle skill build selection from picker
export const handleSkillBuildSelect = (data, editorApi) => {
  const { syntax } = data;

  // Insert skill build syntax into content
  // Format: {{skill-build:userId:buildId:mode}}
  editorApi.insertAtCursor(`\n\n${syntax}  \n\n`);
};

// Handle spirit build selection from picker
export const handleSpiritBuildSelect = (data, editorApi) => {
  const { syntax } = data;

  // Insert spirit build syntax into content
  // Format: {{spirit-build:userId:buildId:mode}}
  editorApi.insertAtCursor(`\n\n${syntax}  \n\n`);
};
