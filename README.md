# EQUIP Registers - Modular System

> Note: Legacy and reference documents (old weekly report module, legacy HTC standalone form, architecture & template drafts) have been moved to `archive/` to keep the root clean. They are excluded from builds and deployment.

## ✅ Implementation Complete

Your EQUIP Health Ghana system now features a fully modular architecture with separated concerns for better maintainability and scalability.

## 📁 Modular Architecture

### 1. **register-templates.js** - Register Templates
   - Contains 6 pre-built health registers
   - Easy to add, modify, or remove register definitions
   - Independent from core application logic

### 2. **users.js** - User & Role Management
   - Complete user lifecycle management (create, read, update, delete)
   - Role management and assignment
   - Register and CSO assignment logic
   - Permission management
   - Scope/hierarchy handling
   - Independent, reusable module

### 3. **app.js** - Core Application Logic
   - Main application orchestration
   - Form builder and data entry
   - Record management
   - Authentication and authorization
   - Delegates to specialized modules

### 4. **index.html** - User Interface
   - Clean separation of presentation from logic
   - Bootstrap 5.3 responsive design
   - Glassmorphism styling


## 🎯 Benefits of Modular Architecture

### ✅ Register Templates Module (`register-templates.js`)
- **Easy to extend**: Add new health registers without touching core code
- **Shareable**: Export/import templates between installations
- **Maintainable**: All register definitions in one file
- **Version controlled**: Track changes to register structures easily

### ✅ User Management Module (`users.js`)
- **Separation of concerns**: All user/role logic in dedicated module
- **Reusable**: Can be used in other projects
- **Testable**: Independent module is easier to test
- **Maintainable**: Changes to user management don't affect core app

### ✅ Core Application (`app.js`)
- **Cleaner code**: Delegates to specialized modules
- **Focused responsibility**: Handles app orchestration and forms
- **Easier debugging**: Smaller, more focused codebase
- **Better performance**: Modular loading and execution

## 📊 Pre-Built Registers

Your system includes 6 health registers:
1. **HTC** - HIV Testing & Counselling (21 fields)
2. **ART** - Antiretroviral Therapy (24 fields)
3. **TB** - Tuberculosis Register (23 fields)
4. **MALARIA** - Malaria Case Register (22 fields)
5. **ANC** - Antenatal Care (29 fields)
6. **PMTCT** - Prevention of MTCT (29 fields)

All registers auto-create on first load and are ready for assignment!


## 🔧 File Structure

```
equip-registers/
├── register-templates.js       ← Register definitions (modular)
├── users.js                    ← User & role management (modular)
├── app.js                      ← Core application logic
├── index.html                  ← UI structure
├── HTC.html                    ← Legacy standalone form (reference)
├── REGISTER_TEMPLATES.md       ← Register templates documentation
├── README.md                   ← This file (main documentation)
├── cso.json                    ← CSO-to-district mapping
└── facilities/                 ← Regional facility data
    ├── Ahafo.json
    ├── Ashanti.json
    └── ... (16 regions total)
```

## � Quick Start Guides

### Adding a New Register
1. Open `register-templates.js`
2. Add your template to `RegisterTemplates` object
3. Add key to `initializePrebuiltRegisters()` in `app.js`
4. Reload → Done!

### Managing Users
- All user management is in `users.js`
- Create users with register and CSO assignments
- Assign granular permissions
- Set geographical scope/hierarchy

### Customizing User Management
- Edit `users.js` to modify user workflows
- Add new permission types
- Customize assignment logic
- Independent from core app

## 🎓 Next Steps

1. **Test the system**: Log in as admin and verify all 6 registers appear
2. **Assign registers**: Test assigning different registers to different users
3. **Add your own**: Create a custom register using the template system
4. **Share**: Export templates and share with other EQUIP implementations

## 📖 Documentation

See `REGISTER_TEMPLATES.md` for:
- Complete template format reference
- Supported field types
- Best practices
- Troubleshooting guide
- Future enhancement ideas

## ✨ System Features

- ✅ **Automatic initialization** - All templates load on app start
- ✅ **Duplicate prevention** - Won't create registers that already exist
- ✅ **Category organization** - Group registers by health domain
- ✅ **Flexible field types** - Text, numbers, dates, dropdowns, CSO selection
- ✅ **Permission integration** - Works with existing access control system
- ✅ **No data loss** - Existing register data is preserved

---

**Congratulations!** Your EQUIP Health Ghana system now has a powerful, maintainable template system for managing health registers. 🎉
