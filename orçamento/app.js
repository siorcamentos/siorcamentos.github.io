// ============================================
    // ConstrutorPro - Cálculo de Orçamento Mobile
    // Baseado em construcao_db.json
    // ============================================

    (function() {
        // ---------- Variáveis Globais ----------
        let constructionDB = {};
        let editingCell = null;
        let pilares = [];
        let vigas = [];

        const systemState = {
            lastCalculation: null,
            materials: [],
            labor: [],
            totals: { cement: 0, sand: 0, gravel: 0, lime: 0, bricks: 0 },
            schedule: { masonry: 0, structure: 0, finishing: 0, total: 0 },
            financial: { laborMasonry: 0, laborStructure: 0, laborFinishing: 0, subtotal: 0, profit: 0, total: 0 }
        };

        // ---------- Funções Auxiliares ----------
        function formatCurrency(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        }

        // ---------- Carregar JSON (com fallback) ----------
        async function loadConstructionData() {
            try {
                const response = await fetch('construcao_db.json');
                if (!response.ok) throw new Error('Erro ao carregar dados');
                constructionDB = await response.json();
                console.log('Dados carregados com sucesso:', constructionDB);
            } catch (error) {
                console.error('Erro ao carregar dados, usando fallback:', error);
                constructionDB = getFallbackData();
            }
            populateMasonryTypes();
            populatePillarTypes();
            populateBeamTypes();
        }

        function getFallbackData() {
            // (copie aqui o conteúdo do fallback do JSON original, ou use o próprio JSON fornecido)
            return {
                // ... fallback completo ...
            };
        }

        // ---------- Popular selects ----------
        function populateMasonryTypes() {
            const select = document.getElementById('masonry-type');
            if (!select) return;
            select.innerHTML = '';
            if (constructionDB.phases?.masonry?.items) {
                constructionDB.phases.masonry.items.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.name;
                    select.appendChild(option);
                });
            }
        }

        function populatePillarTypes() {
            const select = document.getElementById('pillar-type');
            if (!select) return;
            select.innerHTML = '';
            const levels = constructionDB.phases?.structure?.labor_pricing?.pillar_unit?.complexity_levels;
            if (levels) {
                levels.forEach(level => {
                    const option = document.createElement('option');
                    option.value = level.id;
                    option.textContent = level.condition_label;
                    select.appendChild(option);
                });
            }
        }

        function populateBeamTypes() {
            const select = document.getElementById('beam-type');
            if (!select) return;
            select.innerHTML = '';
            const methods = constructionDB.phases?.structure?.labor_pricing?.beam_linear_meter?.methods;
            if (methods) {
                methods.forEach(method => {
                    const option = document.createElement('option');
                    option.value = method.id;
                    option.textContent = method.name;
                    select.appendChild(option);
                });
            }
        }

        // ---------- Obter dimensões padrão do pilar ----------
        function getPillarDimensions(type) {
            const pillarStandards = constructionDB.phases?.structure?.pillar_standards?.valid_dimensions_cm || [];
            let width = 0.15, depth = 0.20, label = 'Pilar Comum (Muro)';
            if (type === 'light') {
                const found = pillarStandards.find(p => p.width === 15 && p.depth === 20);
                if (found) { width = found.width/100; depth = found.depth/100; label = found.label; }
            } else if (type === 'medium') {
                const found = pillarStandards.find(p => p.width === 15 && p.depth === 30);
                if (found) { width = found.width/100; depth = found.depth/100; label = found.label; }
            } else if (type === 'heavy') {
                const found = pillarStandards.find(p => p.width === 20 && p.depth === 30);
                if (found) { width = found.width/100; depth = found.depth/100; label = found.label; }
            }
            return { width, depth, label };
        }

        // ---------- Garantir a existência de um pilar principal ----------
        function ensureMainPillar() {
            if (!document.getElementById('include-pillars')?.checked) return;

            if (pilares.length === 0) {
                createMainPillarFromInputs();
                return;
            }

            const mainIndex = pilares.findIndex(p => p.isMain);
            if (mainIndex >= 0) {
                updateMainPillarFromInputs(pilares[mainIndex]);
            } else {
                pilares[0].isMain = true;
                updateMainPillarFromInputs(pilares[0]);
            }
        }

        function createMainPillarFromInputs() {
            const type = document.getElementById('pillar-type')?.value || 'light';
            const defaultDims = getPillarDimensions(type);
            const width = (parseFloat(document.getElementById('pillar-width')?.value) || 15) / 100;
            const depth = (parseFloat(document.getElementById('pillar-depth')?.value) || 20) / 100;
            const height = parseFloat(document.getElementById('pillar-height')?.value) || 2.5;
            const count = parseInt(document.getElementById('pillars-count')?.value) || 1;
            const hasSapata = document.getElementById('include-sapatas')?.checked || false;
            const sapataWidth = (parseFloat(document.getElementById('sapata-width')?.value) || 50) / 100;
            const sapataLength = (parseFloat(document.getElementById('sapata-length')?.value) || 50) / 100;
            const sapataHeight = (parseFloat(document.getElementById('sapata-height')?.value) || 60) / 100;

            pilares.push({
                id: pilares.length + 1,
                type,
                label: defaultDims.label,
                width: width > 0 ? width : defaultDims.width,
                depth: depth > 0 ? depth : defaultDims.depth,
                height,
                count,
                hasSapata,
                sapataWidth,
                sapataLength,
                sapataHeight,
                isMain: true
            });
        }

        function updateMainPillarFromInputs(mainPillar) {
            const type = document.getElementById('pillar-type')?.value || 'light';
            const defaultDims = getPillarDimensions(type);
            mainPillar.type = type;
            mainPillar.label = defaultDims.label;
            mainPillar.width = (parseFloat(document.getElementById('pillar-width')?.value) || 15) / 100;
            if (mainPillar.width <= 0) mainPillar.width = defaultDims.width;
            mainPillar.depth = (parseFloat(document.getElementById('pillar-depth')?.value) || 20) / 100;
            if (mainPillar.depth <= 0) mainPillar.depth = defaultDims.depth;
            mainPillar.height = parseFloat(document.getElementById('pillar-height')?.value) || 2.5;
            mainPillar.count = parseInt(document.getElementById('pillars-count')?.value) || 1;
            mainPillar.hasSapata = document.getElementById('include-sapatas')?.checked || false;
            mainPillar.sapataWidth = (parseFloat(document.getElementById('sapata-width')?.value) || 50) / 100;
            mainPillar.sapataLength = (parseFloat(document.getElementById('sapata-length')?.value) || 50) / 100;
            mainPillar.sapataHeight = (parseFloat(document.getElementById('sapata-height')?.value) || 60) / 100;
        }

        // ---------- Inicialização ----------
        async function init() {
            await loadConstructionData();
            attachEventListeners();
            attachPillarInputListeners();
            updateFinishingUI();
            calculateProject();
        }

        function attachEventListeners() {
            document.getElementById('use-auto-area')?.addEventListener('change', function(e) {
                const dim = document.getElementById('dimension-inputs');
                const direct = document.getElementById('direct-area-option');
                if (dim && direct) {
                    dim.style.display = e.target.checked ? 'grid' : 'none';
                    direct.style.display = e.target.checked ? 'none' : 'block';
                }
            });

            document.getElementById('foundation-type')?.addEventListener('change', function(e) {
                const widthContainer = document.getElementById('foundation-width-container');
                if (widthContainer) {
                    widthContainer.classList.toggle('hidden', e.target.value !== 'baldrame');
                }
            });

            document.getElementById('include-foundation')?.addEventListener('change', function(e) {
                document.getElementById('foundation-config')?.classList.toggle('hidden', !e.target.checked);
            });
            document.getElementById('include-pillars')?.addEventListener('change', function(e) {
                document.getElementById('pillars-config')?.classList.toggle('hidden', !e.target.checked);
                if (e.target.checked) {
                    ensureMainPillar();
                    updatePilaresTable();
                    calculateProject();
                }
            });
            document.getElementById('include-sapatas')?.addEventListener('change', function(e) {
                document.getElementById('sapatas-config')?.classList.toggle('hidden', !e.target.checked);
            });
            document.getElementById('include-vigas')?.addEventListener('change', function(e) {
                document.getElementById('vigas-config')?.classList.toggle('hidden', !e.target.checked);
            });

            document.getElementById('chapisco-enabled')?.addEventListener('change', updateFinishingUI);
            document.getElementById('reboco-enabled')?.addEventListener('change', updateFinishingUI);

            ['alvenaria-days', 'estrutura-days', 'acabamento-days'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', function() {
                    const warning = document.getElementById('schedule-warning');
                    if (warning && parseFloat(this.value) > 0) warning.classList.remove('hidden');
                });
            });

            const inputs = document.querySelectorAll('.input-field, select, input[type="checkbox"]:not(#include-pillars)');
            inputs.forEach(input => {
                input.addEventListener('change', () => calculateProject());
            });
        }

        function attachPillarInputListeners() {
            const pillarFields = [
                'pillar-type', 'pillar-width', 'pillar-depth', 'pillar-height',
                'include-sapatas', 'sapata-width', 'sapata-length', 'sapata-height'
            ];
            pillarFields.forEach(id => {
                document.getElementById(id)?.addEventListener('change', function() {
                    if (document.getElementById('include-pillars')?.checked) {
                        ensureMainPillar();
                        updatePilaresTable();
                        calculateProject();
                    }
                });
            });

            document.getElementById('pillars-count')?.addEventListener('change', function(e) {
                if (document.getElementById('include-pillars')?.checked) {
                    const mainPillar = pilares.find(p => p.isMain);
                    if (mainPillar) {
                        mainPillar.count = parseInt(e.target.value) || 0;
                        updatePilaresTable();
                        calculateProject();
                    } else {
                        ensureMainPillar();
                    }
                }
            });
        }

        function updateFinishingUI() {
            const rebocoEnabled = document.getElementById('reboco-enabled')?.checked;
            const typeSection = document.getElementById('reboco-type-section');
            if (typeSection) typeSection.style.display = rebocoEnabled ? 'block' : 'none';
        }

        window.showSection = function(sectionId) {
            document.querySelectorAll('.config-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.config-section').forEach(section => section.classList.remove('active'));

            const tab = document.getElementById(sectionId + '-tab');
            if (tab) tab.classList.add('active');
            const section = document.getElementById(sectionId + '-section');
            if (section) section.classList.add('active');
        };

        window.addPilarRow = function() {
            if (!document.getElementById('include-pillars')?.checked) return;

            const type = document.getElementById('pillar-type')?.value || 'light';
            const height = parseFloat(document.getElementById('pillar-height')?.value) || 2.5;
            const width = (parseFloat(document.getElementById('pillar-width')?.value) || 15) / 100;
            const depth = (parseFloat(document.getElementById('pillar-depth')?.value) || 20) / 100;
            const count = parseInt(document.getElementById('pillars-count')?.value) || 1;

            const defaultDims = getPillarDimensions(type);
            const finalWidth = width > 0 ? width : defaultDims.width;
            const finalDepth = depth > 0 ? depth : defaultDims.depth;

            pilares.push({
                id: pilares.length + 1,
                type,
                label: defaultDims.label,
                width: finalWidth,
                depth: finalDepth,
                height,
                count,
                hasSapata: document.getElementById('include-sapatas')?.checked || false,
                sapataWidth: (parseFloat(document.getElementById('sapata-width')?.value) || 50) / 100,
                sapataLength: (parseFloat(document.getElementById('sapata-length')?.value) || 50) / 100,
                sapataHeight: (parseFloat(document.getElementById('sapata-height')?.value) || 60) / 100,
                isMain: false
            });
            updatePilaresTable();
            calculateProject();
        };

        function updatePilaresTable() {
            const tbody = document.getElementById('pillars-table-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            pilares.forEach((p, idx) => {
                const row = document.createElement('tr');
                if (p.isMain) row.classList.add('bg-blue-50');
                row.innerHTML = `
                    <td>${p.label || p.type} ${p.isMain ? '(principal)' : ''}</td>
                    <td>${(p.width*100).toFixed(0)}x${(p.depth*100).toFixed(0)}cm</td>
                    <td>${p.count}</td>
                    <td><button onclick="removePilar(${idx})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                `;
                tbody.appendChild(row);
            });
            document.getElementById('pillars-table')?.classList.toggle('hidden', pilares.length === 0);
        }

        window.removePilar = function(index) {
            const wasMain = pilares[index]?.isMain;
            pilares.splice(index, 1);
            if (wasMain && document.getElementById('include-pillars')?.checked) {
                ensureMainPillar();
            }
            updatePilaresTable();
            calculateProject();
        };

        window.addVigaRow = function() {
            const type = document.getElementById('beam-type')?.value || 'canaleta_u';
            const width = (parseFloat(document.getElementById('beam-width')?.value) || 15) / 100;
            const height = (parseFloat(document.getElementById('beam-height')?.value) || 20) / 100;
            const length = parseFloat(document.getElementById('beam-length')?.value) || 10;

            vigas.push({ id: vigas.length + 1, type, width, height, length });
            updateVigasTable();
            calculateProject();
        };

        function updateVigasTable() {
            const tbody = document.getElementById('vigas-table-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            vigas.forEach((v, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${v.type}</td>
                    <td>${(v.width*100).toFixed(0)}x${(v.height*100).toFixed(0)}cm</td>
                    <td>${v.length}m</td>
                    <td><button onclick="removeViga(${idx})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                `;
                tbody.appendChild(row);
            });
            document.getElementById('vigas-table')?.classList.toggle('hidden', vigas.length === 0);
        }

        window.removeViga = function(index) {
            vigas.splice(index, 1);
            updateVigasTable();
            calculateProject();
        };

        window.updateScheduleManually = function() {
            const masonryDays = parseFloat(document.getElementById('alvenaria-days')?.value) || 0;
            const structureDays = parseFloat(document.getElementById('estrutura-days')?.value) || 0;
            const finishingDays = parseFloat(document.getElementById('acabamento-days')?.value) || 0;
            const total = Math.max(masonryDays, structureDays) + finishingDays;
            const margin = constructionDB.global_settings?.schedule_rules?.safety_margin_days?.max || 0.2;
            const totalWithMargin = Math.ceil(total * (1 + Math.min(margin, 0.3)));
            document.getElementById('total-days-input').value = totalWithMargin;
            calculateProject();
        };

        function getInputValues() {
            return {
                useAutoArea: document.getElementById('use-auto-area')?.checked ?? true,
                wallLength: parseFloat(document.getElementById('wall-length')?.value) || 0,
                wallHeight: parseFloat(document.getElementById('wall-height')?.value) || 0,
                directWallArea: parseFloat(document.getElementById('direct-wall-area')?.value) || 0,
                masonryType: document.getElementById('masonry-type')?.value || '',
                includeFoundation: document.getElementById('include-foundation')?.checked || false,
                foundationType: document.getElementById('foundation-type')?.value || 'alvenaria',
                foundationLength: parseFloat(document.getElementById('foundation-length')?.value) || 0,
                foundationHeight: parseFloat(document.getElementById('foundation-height')?.value) || 0,
                foundationWidth: parseFloat(document.getElementById('foundation-width')?.value) || 0,
                includePillars: document.getElementById('include-pillars')?.checked || false,
                pillarsCount: parseInt(document.getElementById('pillars-count')?.value) || 0,
                pillarType: document.getElementById('pillar-type')?.value || 'light',
                pillarHeight: parseFloat(document.getElementById('pillar-height')?.value) || 0,
                pillarWidth: parseFloat(document.getElementById('pillar-width')?.value) || 0,
                pillarDepth: parseFloat(document.getElementById('pillar-depth')?.value) || 0,
                includeSapatas: document.getElementById('include-sapatas')?.checked || false,
                sapataWidth: parseFloat(document.getElementById('sapata-width')?.value) || 0,
                sapataLength: parseFloat(document.getElementById('sapata-length')?.value) || 0,
                sapataHeight: parseFloat(document.getElementById('sapata-height')?.value) || 0,
                includeVigas: document.getElementById('include-vigas')?.checked || false,
                beamWidth: parseFloat(document.getElementById('beam-width')?.value) || 0,
                beamHeight: parseFloat(document.getElementById('beam-height')?.value) || 0,
                beamLength: parseFloat(document.getElementById('beam-length')?.value) || 0,
                beamType: document.getElementById('beam-type')?.value || '',
                chapiscoEnabled: document.getElementById('chapisco-enabled')?.checked || false,
                rebocoEnabled: document.getElementById('reboco-enabled')?.checked || false,
                finishingFaces: parseInt(document.getElementById('finishing-faces')?.value) || 1,
                finishingThickness: parseFloat(document.getElementById('finishing-thickness')?.value) || 0,
                finishingType: document.getElementById('finishing-type')?.value || 'reboco_interno',
                bricklayerCount: parseInt(document.getElementById('bricklayer-count')?.value) || 1,
                dailyBricklayer: parseFloat(document.getElementById('daily-bricklayer')?.value) || 0,
                helperCount: parseInt(document.getElementById('helper-count')?.value) || 0,
                dailyHelper: parseFloat(document.getElementById('daily-helper')?.value) || 0,
                masonryDays: parseFloat(document.getElementById('alvenaria-days')?.value) || 0,
                structureDays: parseFloat(document.getElementById('estrutura-days')?.value) || 0,
                finishingDays: parseFloat(document.getElementById('acabamento-days')?.value) || 0,
                profitMargin: parseFloat(document.getElementById('profit-margin')?.value) || 0
            };
        }

        function resetSystemState() {
            systemState.materials = [];
            systemState.labor = [];
            systemState.totals = { cement: 0, sand: 0, gravel: 0, lime: 0, bricks: 0 };
            systemState.schedule = { masonry: 0, structure: 0, finishing: 0, total: 0 };
            systemState.financial = { laborMasonry: 0, laborStructure: 0, laborFinishing: 0, subtotal: 0, profit: 0, total: 0 };
        }

        function calculateMasonry(inputs, wallArea) {
            const masonryItem = constructionDB.phases?.masonry?.items?.find(item => item.id === inputs.masonryType);
            if (!masonryItem) return;

            const mode = masonryItem.modes?.standard_wall || masonryItem.modes?.standard;
            if (!mode) return;

            let bricksQty = wallArea * mode.qty_per_m2;
            bricksQty *= (1 + (constructionDB.global_settings?.waste_margins?.bricks || 0.1));
            bricksQty = Math.ceil(bricksQty);

            const cementForMortar = wallArea * (mode.mortar_cement_factor || 0.12);
            const cementBags = Math.ceil(cementForMortar);
            const sandForMortar = cementForMortar * 0.25; // ← ajustado para 0.25 m³ por saco

            systemState.totals.bricks += bricksQty;
            systemState.totals.cement += cementBags;
            systemState.totals.sand += sandForMortar;

            systemState.materials.push(
                { phase: 'ALVENARIA', description: 'Tijolos/Blocos - alvenaria do muro', unit: 'un', quantity: bricksQty },
                { phase: 'ALVENARIA', description: 'Cimento CP II - alvenaria', unit: 'saco 50kg', quantity: cementBags },
                { phase: 'ALVENARIA', description: 'Areia grossa - alvenaria', unit: 'm³', quantity: sandForMortar.toFixed(2) }
            );

            const prod = constructionDB.phases?.masonry?.productivity_rules?.bricklaying?.team_daily_rate?.avg || 225;
            let laborDays = inputs.masonryDays > 0 ? inputs.masonryDays : Math.ceil(bricksQty / prod);
            const dailyCost = (inputs.dailyBricklayer * inputs.bricklayerCount) + (inputs.dailyHelper * inputs.helperCount);
            const laborCost = laborDays * dailyCost;

            systemState.schedule.masonry = laborDays;
            systemState.financial.laborMasonry = laborCost;

            systemState.labor.push({
                phase: 'ALVENARIA',
                description: `Mão de obra alvenaria (${inputs.bricklayerCount} pedreiro(s) + ${inputs.helperCount} ajudante(s))`,
                unit: 'dia',
                quantity: laborDays,
                unitPrice: dailyCost,
                total: laborCost
            });
        }

        function calculateFoundation(inputs) {
            if (inputs.foundationType === 'alvenaria') {
                const masonryItem = constructionDB.phases?.masonry?.items?.find(item => item.id === inputs.masonryType);
                if (!masonryItem) return;
                const mode = masonryItem.modes?.foundation_double;
                if (!mode) return;

                const area = inputs.foundationLength * inputs.foundationHeight;
                let bricks = area * mode.qty_per_m2;
                bricks *= (1 + (constructionDB.global_settings?.waste_margins?.bricks || 0.1));
                bricks = Math.ceil(bricks);

                const cement = area * (mode.mortar_cement_factor || 0.6); // ← aumentado para 0.6 sacos/m²
                const cementBags = Math.ceil(cement);
                const sand = cement * 0.25; // ← ajustado para 0.25 m³ por saco

                systemState.totals.bricks += bricks;
                systemState.totals.cement += cementBags;
                systemState.totals.sand += sand;

                systemState.materials.push(
                    { phase: 'ESTRUTURA', description: 'Tijolos/Blocos - fundação', unit: 'un', quantity: bricks },
                    { phase: 'ESTRUTURA', description: 'Cimento CP II - fundação', unit: 'saco 50kg', quantity: cementBags },
                    { phase: 'ESTRUTURA', description: 'Areia grossa - fundação', unit: 'm³', quantity: sand.toFixed(2) }
                );

                const prod = constructionDB.phases?.masonry?.productivity_rules?.bricklaying?.team_daily_rate?.avg || 225;
                const laborDays = Math.ceil(bricks / prod);
                const dailyCost = (inputs.dailyBricklayer * inputs.bricklayerCount) + (inputs.dailyHelper * inputs.helperCount);
                const laborCost = laborDays * dailyCost;

                systemState.schedule.structure += laborDays;
                systemState.financial.laborStructure += laborCost;
                systemState.labor.push({
                    phase: 'ESTRUTURA',
                    description: `Mão de obra fundação (${inputs.bricklayerCount} pedreiro(s) + ${inputs.helperCount} ajudante(s))`,
                    unit: 'dia',
                    quantity: laborDays,
                    unitPrice: dailyCost,
                    total: laborCost
                });

            } else if (inputs.foundationType === 'baldrame') {
                const volume = inputs.foundationLength * inputs.foundationWidth * inputs.foundationHeight;
                const mix = constructionDB.phases?.structure?.materials_mix?.concrete_standard?.yield_per_m3_final;
                if (!mix) return;

                const cementBags = Math.ceil(volume * mix.cement_bags);
                const sandM3 = volume * mix.sand_m3;
                const gravelM3 = volume * mix.gravel_m3;

                systemState.totals.cement += cementBags;
                systemState.totals.sand += sandM3;
                systemState.totals.gravel += gravelM3;

                systemState.materials.push(
                    { phase: 'ESTRUTURA', description: 'Cimento CP II - baldrame', unit: 'saco 50kg', quantity: cementBags },
                    { phase: 'ESTRUTURA', description: 'Areia média - baldrame', unit: 'm³', quantity: sandM3.toFixed(2) },
                    { phase: 'ESTRUTURA', description: 'Brita 1 - baldrame', unit: 'm³', quantity: gravelM3.toFixed(2) }
                );

                const laborDays = Math.ceil(volume / 2);
                const dailyCost = (inputs.dailyBricklayer * inputs.bricklayerCount) + (inputs.dailyHelper * inputs.helperCount);
                const laborCost = laborDays * dailyCost;

                systemState.schedule.structure += laborDays;
                systemState.financial.laborStructure += laborCost;
                systemState.labor.push({
                    phase: 'ESTRUTURA',
                    description: `Mão de obra baldrame (${inputs.bricklayerCount} pedreiro(s) + ${inputs.helperCount} ajudante(s))`,
                    unit: 'dia',
                    quantity: laborDays,
                    unitPrice: dailyCost,
                    total: laborCost
                });
            }
        }

        function calculateStructure(inputs) {
            if (inputs.includePillars) {
                ensureMainPillar();
            }

            if (inputs.includeVigas && vigas.length === 0) {
                vigas.push({
                    id: 1,
                    type: inputs.beamType,
                    width: inputs.beamWidth/100,
                    height: inputs.beamHeight/100,
                    length: inputs.beamLength
                });
            }

            let totalPillarVolume = 0, totalSapataVolume = 0, totalBeamVolume = 0;
            let totalPillarsCount = 0, totalPillarDays = 0;

            pilares.forEach(p => {
                const vol = p.width * p.depth * p.height * p.count;
                totalPillarVolume += vol;
                totalPillarsCount += p.count;

                if (p.hasSapata) {
                    totalSapataVolume += p.sapataWidth * p.sapataLength * p.sapataHeight * p.count;
                }

                const prod = constructionDB.phases?.structure?.productivity_rules?.pillar_complete_process?.team_daily_rate?.avg || 3;
                let days = p.count / prod;
                if (p.height > 2.0) days *= 1.5;
                const sizeFactor = (p.width * p.depth) / (0.15 * 0.20);
                if (sizeFactor > 1.2) days *= 1.2;
                if (p.count > 5) days += (p.count - 5) * 0.2;
                totalPillarDays += days;
            });

            vigas.forEach(v => {
                totalBeamVolume += v.width * v.height * v.length;
            });

            const totalConcrete = totalPillarVolume + totalSapataVolume + totalBeamVolume;
            if (totalConcrete > 0) {
                const mix = constructionDB.phases?.structure?.materials_mix?.concrete_standard?.yield_per_m3_final;
                if (mix) {
                    const cement = Math.ceil(totalConcrete * mix.cement_bags);
                    const sand = totalConcrete * mix.sand_m3;
                    const gravel = totalConcrete * mix.gravel_m3;
                    systemState.totals.cement += cement;
                    systemState.totals.sand += sand;
                    systemState.totals.gravel += gravel;

                    systemState.materials.push(
                        { phase: 'ESTRUTURA', description: 'Cimento CP II - concreto estrutural', unit: 'saco 50kg', quantity: cement },
                        { phase: 'ESTRUTURA', description: 'Areia média - concreto estrutural', unit: 'm³', quantity: sand.toFixed(2) },
                        { phase: 'ESTRUTURA', description: 'Brita 1 - concreto estrutural', unit: 'm³', quantity: gravel.toFixed(2) }
                    );
                }
            }

            if (totalPillarsCount > 0) {
                const pricing = constructionDB.phases?.structure?.labor_pricing?.pillar_unit;
                let totalPillarCost = 0;
                pilares.forEach(p => {
                    const level = pricing?.complexity_levels?.find(l => l.id === p.type);
                    const price = level ? level.price_override : (pricing?.base_price || 230);
                    totalPillarCost += price * p.count;
                });
                systemState.financial.laborStructure += totalPillarCost;

                if (totalPillarDays < 0.5) totalPillarDays = 0.5;
                else totalPillarDays = Math.ceil(totalPillarDays * 2) / 2;
                systemState.schedule.structure += totalPillarDays;

                systemState.labor.push({
                    phase: 'ESTRUTURA',
                    description: `Mão de obra pilares (${totalPillarsCount} un)`,
                    unit: 'un',
                    quantity: totalPillarsCount,
                    unitPrice: totalPillarCost / totalPillarsCount,
                    total: totalPillarCost
                });
            }

            if (vigas.length > 0) {
                let totalLength = 0, totalCost = 0;
                vigas.forEach(v => {
                    const method = constructionDB.phases?.structure?.labor_pricing?.beam_linear_meter?.methods?.find(m => m.id === v.type);
                    const pricePerM = method ? method.price_per_m : 70;
                    totalCost += pricePerM * v.length;
                    totalLength += v.length;
                });
                systemState.financial.laborStructure += totalCost;

                let beamDays = Math.ceil(totalLength / 6);
                if (beamDays < 1 && totalLength > 0) beamDays = 0.5;
                systemState.schedule.structure += beamDays;

                systemState.labor.push({
                    phase: 'ESTRUTURA',
                    description: `Mão de obra vigas (${totalLength.toFixed(1)} m)`,
                    unit: 'm',
                    quantity: totalLength,
                    unitPrice: totalCost / totalLength,
                    total: totalCost
                });
            }
        }

        function calculateFinishing(inputs, wallArea) {
            const faces = inputs.finishingFaces;
            const area = wallArea * faces;

            if (inputs.chapiscoEnabled && !inputs.rebocoEnabled) {
                const chap = constructionDB.phases?.finishing?.layers?.chapisco_comum;
                if (chap) {
                    const cementKg = area * chap.consumption_per_m2.cement_kg;
                    const cementBags = Math.ceil(cementKg / (constructionDB.global_settings?.packaging?.cement_bag_kg || 50));
                    const sandM3 = area * chap.consumption_per_m2.sand_m3;
                    systemState.totals.cement += cementBags;
                    systemState.totals.sand += sandM3;
                    systemState.materials.push(
                        { phase: 'ACABAMENTO', description: 'Cimento CP II - chapisco', unit: 'saco 50kg', quantity: cementBags },
                        { phase: 'ACABAMENTO', description: 'Areia fina - chapisco', unit: 'm³', quantity: sandM3.toFixed(3) }
                    );

                    const priceM2 = chap.labor_price_market_avg?.price_per_m2 || 7;
                    const laborCost = area * priceM2;
                    systemState.financial.laborFinishing += laborCost;

                    const prod = constructionDB.phases?.finishing?.productivity_rules?.chapisco?.team_daily_rate?.avg || 100;
                    const days = Math.ceil(area / prod);
                    systemState.schedule.finishing += days;

                    systemState.labor.push({
                        phase: 'ACABAMENTO',
                        description: 'Mão de obra chapisco',
                        unit: 'm²',
                        quantity: area.toFixed(1),
                        unitPrice: priceM2,
                        total: laborCost
                    });
                }
            }

            if (inputs.rebocoEnabled) {
                const layerId = inputs.finishingType === 'reboco_interno' ? 'emboço_reboco_interno' : 'reboco_externo_forte';
                const reb = constructionDB.phases?.finishing?.layers?.[layerId];
                if (reb) {
                    const cementKg = area * reb.consumption_per_m2.cement_kg;
                    const cementBags = Math.ceil(cementKg / (constructionDB.global_settings?.packaging?.cement_bag_kg || 50));
                    const sandM3 = area * reb.consumption_per_m2.sand_m3;
                    const limeKg = area * reb.consumption_per_m2.lime_kg;
                    const limeBags = limeKg > 0 ? Math.ceil(limeKg / (constructionDB.global_settings?.packaging?.lime_bag_kg || 20)) : 0;

                    systemState.totals.cement += cementBags;
                    systemState.totals.sand += sandM3;
                    systemState.totals.lime += limeBags;

                    systemState.materials.push(
                        { phase: 'ACABAMENTO', description: 'Cimento CP II - reboco', unit: 'saco 50kg', quantity: cementBags },
                        { phase: 'ACABAMENTO', description: 'Areia fina - reboco', unit: 'm³', quantity: sandM3.toFixed(3) }
                    );
                    if (limeBags > 0) {
                        systemState.materials.push({ phase: 'ACABAMENTO', description: 'Cal hidratada - reboco', unit: 'saco 20kg', quantity: limeBags });
                    }

                    const priceM2 = reb.labor_price_market_avg?.price_per_m2 || 22;
                    const laborCost = area * priceM2;
                    systemState.financial.laborFinishing += laborCost;

                    const prod = constructionDB.phases?.finishing?.productivity_rules?.reboco?.team_daily_rate?.avg || 20;
                    let days = Math.ceil(area / prod);
                    if (days < 2 && area > 20) days = 2;
                    systemState.schedule.finishing = Math.max(systemState.schedule.finishing, days);

                    systemState.labor.push({
                        phase: 'ACABAMENTO',
                        description: 'Mão de obra reboco',
                        unit: 'm²',
                        quantity: area.toFixed(1),
                        unitPrice: priceM2,
                        total: laborCost
                    });
                }
            }
        }

        function calculateSchedule(inputs) {
            let masonryDays = systemState.schedule.masonry;
            let structureDays = systemState.schedule.structure;
            let finishingDays = systemState.schedule.finishing;

            if (inputs.masonryDays > 0) masonryDays = inputs.masonryDays;
            if (inputs.structureDays > 0) structureDays = inputs.structureDays;
            if (inputs.finishingDays > 0) finishingDays = inputs.finishingDays;

            const safety = constructionDB.global_settings?.schedule_rules?.safety_margin_days?.max || 0.2;
            const margin = Math.min(safety, 0.3);

            if (inputs.masonryDays <= 0 && masonryDays > 0) masonryDays = Math.ceil(masonryDays * (1 + margin));
            if (inputs.structureDays <= 0 && structureDays > 0) structureDays = Math.ceil(structureDays * (1 + margin));
            if (inputs.finishingDays <= 0 && finishingDays > 0) finishingDays = Math.ceil(finishingDays * (1 + margin));

            const maxConcurrent = Math.max(masonryDays, structureDays);
            const totalDays = maxConcurrent + finishingDays;

            systemState.schedule.masonry = masonryDays;
            systemState.schedule.structure = structureDays;
            systemState.schedule.finishing = finishingDays;
            systemState.schedule.total = totalDays;

            document.getElementById('total-days-input').value = totalDays;
        }

        function calculateFinancials(inputs) {
            systemState.financial.subtotal = 
                systemState.financial.laborMasonry + 
                systemState.financial.laborStructure + 
                systemState.financial.laborFinishing;
            systemState.financial.profit = systemState.financial.subtotal * (inputs.profitMargin / 100);
            systemState.financial.total = systemState.financial.subtotal + systemState.financial.profit;
        }

        window.calculateProject = function() {
            try {
                console.log('Calculando...');
                const inputs = getInputValues();
                resetSystemState();

                let wallArea;
                if (inputs.useAutoArea) {
                    wallArea = inputs.wallLength * inputs.wallHeight;
                } else {
                    wallArea = inputs.directWallArea;
                }

                calculateMasonry(inputs, wallArea);
                if (inputs.includeFoundation) calculateFoundation(inputs);
                if (inputs.includePillars || inputs.includeVigas) calculateStructure(inputs);
                if (inputs.rebocoEnabled || inputs.chapiscoEnabled) calculateFinishing(inputs, wallArea);

                calculateSchedule(inputs);
                calculateFinancials(inputs);

                updateResults();
                updateMaterialSummary();
                systemState.lastCalculation = inputs;
            } catch (e) {
                console.error('Erro no cálculo:', e);
                alert('Erro ao calcular. Verifique os dados.');
            }
        };

        function updateResults() {
            const container = document.getElementById('results-container');
            if (!container) return;
            container.innerHTML = '';

            if (systemState.materials.filter(m => m.phase === 'ALVENARIA').length > 0 || systemState.labor.filter(l => l.phase === 'ALVENARIA').length > 0) {
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = `<div class="result-phase"><i class="fas fa-cubes"></i>ALVENARIA - MURO</div>`;

                systemState.materials.filter(m => m.phase === 'ALVENARIA').forEach(mat => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${mat.description}</span>
                            <span class="qty" onclick="editCell(this, '${mat.phase}', '${mat.description}', 'quantity')">${mat.quantity}</span>
                            <span class="total">${mat.unit}</span>
                        </div>
                    `;
                });

                systemState.labor.filter(l => l.phase === 'ALVENARIA').forEach(lab => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${lab.description}</span>
                            <span class="qty">${lab.quantity} ${lab.unit}</span>
                            <span class="total">${formatCurrency(lab.total)}</span>
                        </div>
                    `;
                });

                card.innerHTML += `<div class="subtotal-row"><span>Subtotal Alvenaria</span><span>${formatCurrency(systemState.financial.laborMasonry)}</span></div>`;
                container.appendChild(card);
            }

            if (systemState.materials.filter(m => m.phase === 'ESTRUTURA').length > 0 || systemState.labor.filter(l => l.phase === 'ESTRUTURA').length > 0) {
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = `<div class="result-phase"><i class="fas fa-grip-vertical"></i>ESTRUTURA</div>`;

                systemState.materials.filter(m => m.phase === 'ESTRUTURA').forEach(mat => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${mat.description}</span>
                            <span class="qty" onclick="editCell(this, '${mat.phase}', '${mat.description}', 'quantity')">${mat.quantity}</span>
                            <span class="total">${mat.unit}</span>
                        </div>
                    `;
                });

                systemState.labor.filter(l => l.phase === 'ESTRUTURA').forEach(lab => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${lab.description}</span>
                            <span class="qty">${lab.quantity} ${lab.unit}</span>
                            <span class="total">${formatCurrency(lab.total)}</span>
                        </div>
                    `;
                });

                card.innerHTML += `<div class="subtotal-row"><span>Subtotal Estrutura</span><span>${formatCurrency(systemState.financial.laborStructure)}</span></div>`;
                container.appendChild(card);
            }

            if (systemState.materials.filter(m => m.phase === 'ACABAMENTO').length > 0 || systemState.labor.filter(l => l.phase === 'ACABAMENTO').length > 0) {
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = `<div class="result-phase"><i class="fas fa-trowel"></i>ACABAMENTO</div>`;

                systemState.materials.filter(m => m.phase === 'ACABAMENTO').forEach(mat => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${mat.description}</span>
                            <span class="qty" onclick="editCell(this, '${mat.phase}', '${mat.description}', 'quantity')">${mat.quantity}</span>
                            <span class="total">${mat.unit}</span>
                        </div>
                    `;
                });

                systemState.labor.filter(l => l.phase === 'ACABAMENTO').forEach(lab => {
                    card.innerHTML += `
                        <div class="result-item">
                            <span class="desc">${lab.description}</span>
                            <span class="qty">${lab.quantity} ${lab.unit}</span>
                            <span class="total">${formatCurrency(lab.total)}</span>
                        </div>
                    `;
                });

                card.innerHTML += `<div class="subtotal-row"><span>Subtotal Acabamento</span><span>${formatCurrency(systemState.financial.laborFinishing)}</span></div>`;
                container.appendChild(card);
            }

            if (container.children.length === 0) {
                container.innerHTML = `<div class="result-card text-center text-gray-500 py-8">
                    <i class="fas fa-calculator text-4xl mb-3"></i>
                    <p>Execute o cálculo para visualizar os resultados</p>
                </div>`;
            }
        }

        function updateMaterialSummary() {
            const inputs = getInputValues();

            document.getElementById('total-cement').textContent = `${systemState.totals.cement} sacos`;
            document.getElementById('total-sand').textContent = `${systemState.totals.sand.toFixed(2)} m³`;
            document.getElementById('total-gravel').textContent = `${systemState.totals.gravel.toFixed(2)} m³`;
            document.getElementById('total-lime').textContent = `${systemState.totals.lime} sacos`;
            document.getElementById('total-bricks').textContent = `${systemState.totals.bricks} un`;
            document.getElementById('total-days-summary').textContent = `${systemState.schedule.total} dias`;

            document.getElementById('labor-masonry').textContent = formatCurrency(systemState.financial.laborMasonry);
            document.getElementById('labor-structure').textContent = formatCurrency(systemState.financial.laborStructure);
            document.getElementById('labor-finishing').textContent = formatCurrency(systemState.financial.laborFinishing);
            document.getElementById('subtotal-labor').textContent = formatCurrency(systemState.financial.subtotal);
            document.getElementById('profit-percent').textContent = `${Math.round(inputs.profitMargin)}%`;
            document.getElementById('profit-value').textContent = formatCurrency(systemState.financial.profit);
            document.getElementById('total-project').textContent = formatCurrency(systemState.financial.total);

            document.getElementById('masonry-days').textContent = `${systemState.schedule.masonry} dias`;
            document.getElementById('structure-days').textContent = `${systemState.schedule.structure} dias`;
            document.getElementById('finishing-days').textContent = `${systemState.schedule.finishing} dias`;
        }

        window.editCell = function(cell, phase, itemName, field) {
            if (editingCell) return;
            const current = cell.textContent.trim();
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'editable-input';
            input.value = current;
            input.style.width = '80px';
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();

            editingCell = { cell, phase, itemName, field };

            input.addEventListener('blur', function() {
                cell.textContent = input.value;
                const material = systemState.materials.find(m => m.phase === phase && m.description === itemName);
                if (material) material.quantity = input.value;
                editingCell = null;
                calculateProject();
            });
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') input.blur();
            });
        };

        window.editMaterialQuantity = function(elementId) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const txt = el.textContent;
            const parts = txt.split(' ');
            const val = parts[0];
            const unit = parts.slice(1).join(' ');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = val;
            input.className = 'editable-input';
            input.style.width = '80px';
            input.style.textAlign = 'right';
            el.innerHTML = '';
            el.appendChild(input);
            input.focus();

            input.addEventListener('blur', function() {
                el.textContent = input.value + ' ' + unit;
                calculateProject();
            });
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') input.blur();
            });
        };

        window.saveEstimate = function() {
            if (!systemState.lastCalculation) {
                alert('Calcule o projeto primeiro.');
                return;
            }
            const data = {
                title: `Muro ${systemState.lastCalculation.wallLength}m x ${systemState.lastCalculation.wallHeight}m`,
                type: 'alvenaria',
                date: new Date().toLocaleDateString('pt-BR'),
                materials: systemState.materials,
                labor: systemState.labor,
                totals: systemState.totals,
                schedule: systemState.schedule,
                financial: systemState.financial,
                total: systemState.financial.total
            };
            localStorage.setItem('importedServiceData', JSON.stringify(data));
            alert('Orçamento salvo!');
        };

        document.addEventListener('DOMContentLoaded', init);
    })();