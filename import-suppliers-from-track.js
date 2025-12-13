const fs = require('fs');
const mysql = require('mysql2/promise');

// Supplier data extracted from TRACK.EXE SUPPLIER.DBF
const suppliers = [
    { code: 'BIL', name: 'BILSTEIN' },
    { code: 'CONTI', name: 'CONTINENTAL' },
    { code: 'DET', name: 'DETRIOT' },
    { code: 'ELR', name: 'ELRING' },
    { code: 'EZ', name: 'ZIEGLER' },
    { code: 'FEBI', name: 'FEBI' },
    { code: 'GEN', name: 'GENESIS' },
    { code: 'GLYCO', name: 'GLYCO' },
    { code: 'HELLA', name: 'HELLA' },
    { code: 'JL', name: 'J.L.' },
    { code: 'LEM', name: 'LEMFORDER' },
    { code: 'LINT', name: 'LINTREX' },
    { code: 'LLOYD', name: 'LLOYD' },
    { code: 'LUK', name: 'LUK' },
    { code: 'MD', name: 'MD MTRS' },
    { code: 'MEYLE', name: 'MEYLE' },
    { code: 'PB', name: 'PIERBURG' },
    { code: 'PUS', name: 'PUS' },
    { code: 'PVL', name: 'PVL' },
    { code: 'SCHAF', name: 'SCHAFER' },
    { code: 'SW', name: 'SW' },
    { code: 'SWAG', name: 'SWAG' },
    { code: 'SYT', name: 'SYT' },
    { code: 'TL', name: 'T. LAUE' },
    { code: 'TS', name: 'T.S.' },
    { code: 'TD', name: 'TDMANN' },
    { code: 'WAREN', name: 'WARREN' },
    { code: 'ZF', name: 'Z.F.' },
    { code: 'LOCAL', name: 'LOCAL SOURCE' },
    { code: 'ADJ', name: 'INVENTORY ADJUSTMENT' },
    { code: 'MS', name: 'MIN SENG CO. LTD.' },
    { code: 'TT', name: 'TRUCKTEC' },
    { code: 'TERRA', name: 'TERRAMAR' },
    { code: 'GRM', name: 'GRM SING. PTE. LTD' },
    { code: 'WW', name: 'WORLD WIDE' },
    { code: 'GG', name: 'Georg Grotjahn' },
    { code: 'SEK', name: 'SEKURIT' },
    { code: 'FAP', name: 'FRANKFURT AUTO PARTS' },
    { code: 'GAL', name: 'GALLOP AUTO PARTS' },
    { code: 'SS', name: 'Southern Star Motor' },
    { code: 'KIM', name: 'Kimexim' },
    { code: 'GEM', name: 'Gemlib Trading' },
    { code: 'AMT', name: 'AUTO MOTOR TECHNIK' },
    { code: 'SKF', name: 'SKF Philippines' },
    { code: 'ULTRA', name: 'Ultra Autoparts Ltd.' },
    { code: 'MJ', name: 'M J Enterprises' },
    { code: 'DO', name: 'DOGAN OTOMOTIV' },
    { code: 'GLA', name: 'GOLDEN LINK AUTO' },
    { code: 'SACHS', name: 'SACHS AG' },
    { code: 'BB', name: 'Brakes & Bearings' },
    { code: 'LP', name: 'LOCAL PURCHASE' },
    { code: 'PM', name: 'PRIMARY MERCH.' },
    { code: 'WG', name: 'WULF GAERTNER' },
    { code: 'AM', name: 'ALL MERCEDES' },
    { code: 'FM', name: 'FEDERAL MOGUL' },
    { code: 'VIROL', name: 'VIEROL' },
    { code: 'WL', name: 'WL TRADING CORPORATION' },
    { code: 'LD', name: 'L&D Manufacturing' },
    { code: 'ES', name: 'ENG SOON PTE LTD' },
    { code: 'TMD', name: 'TEXTAR BRAKE PADS' },
    { code: 'DL', name: 'DEUTSCHLAND AUTO' },
    { code: 'REG', name: 'RICHTER EXPORT GMBH' },
    { code: 'KH', name: 'KIM HENG IMPEX ENT.' },
    { code: 'DEC', name: 'DECON' },
    { code: 'CMC', name: 'COMMERCIAL MTRS.CORP' },
    { code: 'SUNSL', name: 'SUNSOL MOTORS SUPPLY' },
    { code: 'TANG', name: 'TANGRO ASIA PTE LTD' },
    { code: 'IMC', name: 'INTERAMERICAN MTR.CO' },
    { code: 'BMB', name: 'BUYMBPARTS, INC.' },
    { code: 'NIS', name: 'NISSENS KELERFABRIK' },
    { code: 'TRIPL', name: 'triplus automotive' },
    { code: 'TCL', name: 'TRIPLUS CO. LTD' },
    { code: 'DELO', name: 'DELODUR CORPORATION' },
    { code: 'HAGA', name: 'CELIA HAGAD' },
    { code: 'MANN', name: 'MANN + HUMMEL' },
    { code: 'KAT', name: 'KISTENMACHER AUTO' },
    { code: 'SUCC', name: 'SUCCESS INTL.' },
    { code: 'ZF', name: 'ZF FAR EAST ASIA' },
    { code: 'ERN', name: 'ERNING BUGOY' },
    { code: 'PZ', name: 'PETER ZAHALKA' },
    { code: 'KM', name: 'KM AUTO TECHNIK' },
    { code: 'TERR', name: 'TERRAMAR GmbH' },
    { code: 'GAV', name: 'CYNTHIA GAVINO' },
    { code: 'REINZ', name: 'REINZ DICHTUNGS GMBH' },
    { code: 'BILS', name: 'THYSSENKRUPP BILSTEIN' },
    { code: 'MCR', name: 'MCR AUTO SUPPLY' },
    { code: 'MMC', name: 'MAKNA MKTG. CORP.' },
    { code: 'RDT', name: 'ROYAL DRAGON TRADERS' },
    { code: 'MAHLE', name: 'MAHLE AFTERMKT GMBH' },
    { code: 'CATS', name: 'CATS MOTORS INC.' },
    { code: 'EQP', name: 'GUANG ZHOU EQP AUTO' },
    { code: 'EDL', name: 'EDDIE DE LEON' },
    { code: 'MSMS', name: 'MS MOTOR SERVICE' },
    { code: 'VAL', name: 'VALIANT' },
    { code: 'HENG', name: 'Hengst Automotive' },
    { code: 'ECK', name: 'ECKLERS MBZ PARTS' },
    { code: 'ASH', name: 'ALBERT HENSON USA' },
    { code: 'JOEN', name: 'JN' },
    { code: 'JT', name: 'JAPAN TRADING' },
    { code: 'EAP', name: 'EURO AUTO PARTS INC.' },
    { code: 'ROYAL', name: 'ROYAL DRAGON TRADERS' },
    { code: 'ENKAT', name: 'ENKAT TRADING' },
    { code: 'STAR', name: 'STAR MTRS NY' },
    { code: 'BS', name: 'BERNIE SY' },
    { code: 'IMP', name: 'ISRINGHAUSEN IMPORTS' },
    { code: 'COS', name: 'PETER COSIEP' },
    { code: 'MIL', name: 'MILLER\'S INC.' },
    { code: 'RTS', name: 'RTS MLA. MTRS REP.' },
    { code: 'BL', name: 'BENZLAND AUTO PARTS' },
    { code: 'SPAR', name: 'SPARETO ESTONIA' },
    { code: 'SSF', name: 'SSF IMPORTED PARTS' },
    { code: 'WC', name: 'WALNUT CREEK DB' },
    { code: 'LAZ', name: 'LAZADA' },
    { code: 'PL', name: 'Pleasanton DB' },
    { code: 'RA', name: 'ROCK AUTO' },
    { code: 'LEN', name: 'LENCOOL CHINA' },
    { code: 'PEL', name: 'PELICAN MOTORS' },
    { code: 'MAP', name: 'MODEL AUTOMOTIVE' },
    { code: 'ALI', name: 'ALI EXPRESS' },
    { code: 'OCTO', name: 'Octo Classic' },
    { code: 'AH', name: 'AUTOHAUS AZ' }
];

async function importSuppliers() {
    let connection;
    
    try {
        // Database connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'password',
            database: 'inventory_system'
        });

        console.log('🔄 Connecting to database...');
        
        // Clear existing suppliers first
        await connection.execute('DELETE FROM tbl_suppliers');
        console.log('🗑️ Cleared existing suppliers');
        
        // Insert suppliers from TRACK.EXE
        console.log('📦 Importing suppliers from TRACK.EXE...');
        
        for (const supplier of suppliers) {
            await connection.execute(
                `INSERT INTO tbl_suppliers (supplier_code, supplier_name, is_active, created_at) 
                 VALUES (?, ?, TRUE, NOW())
                 ON DUPLICATE KEY UPDATE 
                 supplier_name = VALUES(supplier_name),
                 updated_at = NOW()`,
                [supplier.code, supplier.name]
            );
        }
        
        console.log(`✅ Successfully imported ${suppliers.length} suppliers from TRACK.EXE!`);
        
        // Show some examples
        const [rows] = await connection.execute('SELECT * FROM tbl_suppliers LIMIT 10');
        console.log('\n📋 Sample imported suppliers:');
        rows.forEach(row => {
            console.log(`  ${row.supplier_code} - ${row.supplier_name}`);
        });
        
    } catch (error) {
        console.error('❌ Error importing suppliers:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the import
importSuppliers();
