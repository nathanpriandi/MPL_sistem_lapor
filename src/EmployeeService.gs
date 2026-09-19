/**
 * EmployeeService.gs — Application Service for Master Employee Registry & Delegation Policies
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Enforces business rules for employee lifecycle, role/delegation policies,
 * identification rules, and custom registry persistence.
 */

const EmployeeService = {

  /**
   * Retrieves active employee registry, prioritizing custom script property if present,
   * falling back to default EMPLOYEE_REGISTRY.
   * @returns {Array<{ id: string, name: string, division: string, role: string, isPic: boolean, delegatedTo?: string }>}
   */
  getActiveRegistry: function() {
    let list = [];
    if (typeof ConfigRepository !== 'undefined' && ConfigRepository.getCustomEmployeeRegistry) {
      try {
        const custom = ConfigRepository.getCustomEmployeeRegistry();
        if (custom && Array.isArray(custom) && custom.length > 0) {
          list = custom;
        }
      } catch (e) {
        Logger.log('EmployeeService: Error reading custom registry: ' + e.toString());
      }
    }

    if (!list || list.length === 0) {
      list = EMPLOYEE_REGISTRY.map(e => ({
        id: e.id,
        name: e.name,
        division: e.division,
        role: e.role || e.division,
        isPic: !!e.isPic,
        delegatedTo: e.delegatedTo || ''
      }));
    }

    // Ensure isPic and role are strictly normalized based on enterprise policy
    list = list.map(e => {
      const cleanId = String(e.id || '').toUpperCase().replace(/[\s\-_]/g, '');
      let isPic = (e.isPic !== undefined) ? !!e.isPic : true;
      if (cleanId.startsWith('SGA')) {
        isPic = (e.role === 'PIC SGA' || cleanId === 'SGA01' || cleanId === 'SGA02');
      } else if (cleanId.startsWith('BKO') || cleanId.startsWith('PKH')) {
        isPic = false;
      }
      const role = (cleanId.startsWith('SGA') && isPic) ? 'PIC SGA' : (e.role || e.division);
      return {
        id: e.id,
        name: e.name,
        division: e.division,
        role: role,
        isPic: isPic,
        delegatedTo: e.delegatedTo || ''
      };
    });

    return JSON.parse(JSON.stringify(list));
  },

  /**
   * Searches employee by ID or Name with forgiving matching
   * (case-insensitive, ignores hyphens/spaces for IDs).
   * @param {string} query
   * @returns {{ id: string, name: string, division: string, role?: string, isPic?: boolean }|null}
   */
  lookupEmployee: function(query) {
    if (!query) return null;
    const rawQ = String(query).trim();
    if (!rawQ) return null;

    const cleanQ = rawQ.toLowerCase().replace(/[\s\-_]/g, '');
    const lowerQ = rawQ.toLowerCase();
    const currentRegistry = this.getActiveRegistry();

    // 1. Exact ID match or normalized ID match (e.g. "alp01" -> "ALP-01")
    const idMatch = currentRegistry.find(e => {
      const cleanId = String(e.id || '').toLowerCase().replace(/[\s\-_]/g, '');
      return cleanId === cleanQ || String(e.id || '').toLowerCase() === lowerQ;
    });
    if (idMatch) return Object.assign({}, idMatch);

    // 2. Exact Name match
    const exactNameMatch = currentRegistry.find(e => String(e.name || '').toLowerCase() === lowerQ);
    if (exactNameMatch) return Object.assign({}, exactNameMatch);

    return null;
  },

  /**
   * Checks if an employee ID is an authorized primary form submitter.
   * @param {string} empId 
   * @returns {boolean}
   */
  isAuthorizedFiller: function(empId) {
    if (!empId) return false;
    const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
    if (clean.startsWith('MNJ') || clean.startsWith('ALP')) return true;
    return clean === 'SGA01' || clean === 'SGA02';
  },

  /**
   * Checks if an employee ID is an authorized SGA PIC.
   * @param {string} empId 
   * @returns {boolean}
   */
  isSgaPic: function(empId) {
    if (!empId) return false;
    const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
    return clean === 'SGA01' || clean === 'SGA02';
  },

  /**
   * Checks if an employee ID is an SGA junior member (non-PIC).
   * @param {string} empId 
   * @returns {boolean}
   */
  isSgaJunior: function(empId) {
    if (!empId) return false;
    const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
    return clean.startsWith('SGA') && clean !== 'SGA01' && clean !== 'SGA02';
  },

  /**
   * Checks if an employee ID is a BKO 28 worker (delegated to Alprof).
   * @param {string} empId 
   * @returns {boolean}
   */
  isBkoSubordinate: function(empId) {
    if (!empId) return false;
    const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
    return clean.startsWith('BKO');
  },

  /**
   * Checks if an employee ID is a Pekerja Harian worker (delegated to Management).
   * @param {string} empId 
   * @returns {boolean}
   */
  isPkhSubordinate: function(empId) {
    if (!empId) return false;
    const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
    return clean.startsWith('PKH');
  },

  /**
   * Creates or updates employee record in custom registry.
   * @param {{ id: string, name: string, division: string, role?: string, isPic?: boolean, oldId?: string }} empData 
   * @returns {{ success: boolean, message: string, employee: Object }}
   */
  saveEmployee: function(empData) {
    if (!empData) throw new Error('Data karyawan tidak valid.');
    const cleanId = String(empData.id || '').trim().toUpperCase();
    const cleanName = String(empData.name || '').trim();
    const cleanDiv = String(empData.division || '').trim();
    const oldId = empData.oldId ? String(empData.oldId).trim().toUpperCase() : null;

    if (!cleanId) throw new Error('ID Karyawan wajib diisi (contoh: ALP-01).');
    if (!cleanName) throw new Error('Nama Karyawan wajib diisi.');
    if (!cleanDiv) throw new Error('Divisi Karyawan wajib dipilih.');

    let list = this.getActiveRegistry();
    const isPic = (empData.isPic !== undefined) ? !!empData.isPic : (cleanDiv !== 'BKO 28' && cleanDiv !== 'Pekerja Harian');
    const role = empData.role || (cleanDiv.includes('SGA') && isPic ? 'PIC SGA' : cleanDiv);
    const newEmp = { id: cleanId, name: cleanName, division: cleanDiv, role: role, isPic: isPic };

    if (oldId && oldId !== cleanId) {
      // Renaming ID: check if new ID already exists
      const conflict = list.find(e => String(e.id).toUpperCase() === cleanId);
      if (conflict) {
        throw new Error(`ID Karyawan '${cleanId}' sudah digunakan oleh ${conflict.name}.`);
      }
      // Remove old entry
      list = list.filter(e => String(e.id).toUpperCase() !== oldId);
      list.push(newEmp);
    } else {
      const existingIdx = list.findIndex(e => String(e.id).toUpperCase() === cleanId);
      if (existingIdx >= 0) {
        list[existingIdx] = newEmp;
      } else {
        list.push(newEmp);
      }
    }

    // Sort list by Division, then ID
    list.sort((a, b) => {
      const divComp = String(a.division).localeCompare(String(b.division));
      if (divComp !== 0) return divComp;
      return String(a.id).localeCompare(String(b.id));
    });

    ConfigRepository.setCustomEmployeeRegistry(list);
    Logger.log(`EmployeeService: Saved employee ${cleanId} (${cleanName}) - total: ${list.length}`);

    return {
      success: true,
      message: `Data karyawan ${cleanName} (${cleanId}) berhasil disimpan.`,
      employee: { id: cleanId, name: cleanName, division: cleanDiv }
    };
  },

  /**
   * Deletes employee record from custom registry.
   * @param {string} empId 
   * @returns {{ success: boolean, message: string }}
   */
  deleteEmployee: function(empId) {
    if (!empId) throw new Error('ID Karyawan tidak valid.');
    const targetId = String(empId).trim().toUpperCase();
    let list = this.getActiveRegistry();

    list = list.filter(e => String(e.id).toUpperCase() !== targetId);

    ConfigRepository.setCustomEmployeeRegistry(list);
    Logger.log(`EmployeeService: Deleted employee ${targetId} - remaining: ${list.length}`);

    return {
      success: true,
      message: `Karyawan ${targetId} berhasil dihapus dari daftar karyawan.`
    };
  },

  /**
   * Resets custom employee registry back to standard 38 records.
   * @returns {{ success: boolean, message: string }}
   */
  resetRegistry: function() {
    ConfigRepository.setCustomEmployeeRegistry(null);
    Logger.log('EmployeeService: Reset custom employee registry to default.');
    return {
      success: true,
      message: 'Data master karyawan berhasil di-reset ke data bawaan awal (38 Karyawan).'
    };
  }
};
